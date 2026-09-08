# CI conventions

Each sample is a standalone project. Give every sample its own CI job so its
working directory, dependency cache, tests, build, and environment contract are
visible in one place.

## Node sample jobs

Copy the commented Node job template in
[`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) when a Node sample
folder lands. Keep the folder name consistent in the job ID, working directory,
and `cache-dependency-path`. Run `npm ci`, `npm test`, and `npm run build` with
Node 22 unless the sample's published SDK has a stricter supported range.

Builds must use placeholder app keys. Never place a real Toggly app key in the
workflow, repository secrets, logs, or committed environment files. Use the
framework-specific public placeholder variable when a browser bundle requires
one.

## Path filtering

GitHub Actions supports `paths` and `paths-ignore` on workflow events, not as a
native `jobs.<job>.paths` setting. Do not add a job-level `paths` key.

As the catalog grows, keep unrelated pull requests fast by adding a changed-file
detection job and condition each sample job on that job's outputs, or split
sample jobs into workflows with event-level `paths` filters. Include the sample
folder, this workflow, and shared catalog or contract files in the relevant
filter. Preserve required-check behavior when choosing between those patterns.

## Dependabot

Add a Dependabot update entry when its sample folder and package manifest land:

- `npm` for JavaScript and Node sample folders
- the matching package ecosystem for future non-Node samples
- `github-actions` once at the repository root

Set `directory` to the actual sample folder. Do not add speculative entries for
planned folders because Dependabot requires the configured directory and
manifest to exist.
