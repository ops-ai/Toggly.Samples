#!/usr/bin/env bash
# Map a Samples PR diff to enrolled LiveE2E sample ids (top-level sample folders).
set -euo pipefail

usage() {
  echo "Usage: $0 <base-sha> <head-sha>" >&2
  exit 2
}

if [[ $# -ne 2 ]]; then
  usage
fi

base_sha="$1"
head_sha="$2"

repo_root="$(git rev-parse --show-toplevel)"
enrolled_file="${LIVEE2E_ENROLLED_IDS_FILE:-$repo_root/.github/livee2e-enrolled-ids.txt}"

if [[ ! -f "$enrolled_file" ]]; then
  echo "Enrolled id list not found: $enrolled_file" >&2
  exit 1
fi

declare -A enrolled=()
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="$(echo "$line" | tr -d '[:space:]')"
  [[ -z "$line" ]] && continue
  enrolled["$line"]=1
done <"$enrolled_file"

merge_base="$(git merge-base "$base_sha" "$head_sha")"

declare -A touched=()
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  top="${path%%/*}"
  if [[ -n "${enrolled[$top]:-}" ]]; then
    touched["$top"]=1
  fi
done < <(git diff --name-only "$merge_base" "$head_sha")

if [[ ${#touched[@]} -eq 0 ]]; then
  exit 0
fi

mapfile -t ids < <(printf '%s\n' "${!touched[@]}" | LC_ALL=C sort)
(IFS=,; echo "${ids[*]}")
