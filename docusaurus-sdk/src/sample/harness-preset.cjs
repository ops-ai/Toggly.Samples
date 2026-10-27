/** Live E2E preset=none uses x-demo-preset / sample-preset (shared harness contract). */
function normalizePreset(raw) {
  if (!raw) return null;
  if (raw === "matching") return "matching";
  if (raw === "nonmatching" || raw === "non-matching") return "nonmatching";
  return null;
}

function readCookie(name) {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) continue;
    try {
      return decodeURIComponent(trimmed.slice(prefix.length));
    } catch {
      return trimmed.slice(prefix.length);
    }
  }
  return undefined;
}

function readHarnessIdentity() {
  if (typeof document === "undefined") return undefined;
  return readCookie("demo-identity") || readCookie("toggly-identity") || undefined;
}

function resolveHarnessPreset() {
  if (typeof window === "undefined") return { preset: "matching", identity: undefined };
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("preset");
  if (raw === "anonymous") return { preset: "nonmatching", identity: undefined };
  const fromQuery = raw && raw !== "none" ? normalizePreset(raw) : null;
  const fromHarness =
    normalizePreset(readCookie("sample-preset")) ||
    normalizePreset(readCookie("toggly-preset"));
  const preset = fromQuery || fromHarness || "matching";
  const identityOverride =
    params.get("identity")?.trim() || readHarnessIdentity()?.trim() || undefined;
  return { preset, identity: identityOverride };
}

module.exports = { normalizePreset, resolveHarnessPreset };
