const PLACEHOLDER_KEYS = new Set([
  'ci-placeholder',
  'telemetry-test-only',
  'offline-test-placeholder',
  'placeholder',
  'YOUR_APP_KEY',
  'your-app-key',
]);

function normalizeAppKey(raw: string | undefined) {
  const trimmed = raw?.trim();
  if (!trimmed || PLACEHOLDER_KEYS.has(trimmed)) return undefined;
  return trimmed;
}

/**
 * Live E2E builds the SSR bundle without secrets, then starts the Node server
 * with TOGGLY_* in process.env. Prefer runtime env over Vite-inlined import.meta.env.
 */
export function readTogglyRuntimeEnv() {
  const runtime = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;

  const appKey =
    normalizeAppKey(runtime?.TOGGLY_APP_KEY) ??
    normalizeAppKey(import.meta.env.TOGGLY_APP_KEY);
  const environment =
    runtime?.TOGGLY_ENVIRONMENT?.trim() ||
    import.meta.env.TOGGLY_ENVIRONMENT ||
    'Production';
  const definitionsBaseUri =
    runtime?.TOGGLY_DEFINITIONS_BASE_URI?.trim() ||
    runtime?.TOGGLY_DEFINITIONS_URL?.trim() ||
    import.meta.env.TOGGLY_DEFINITIONS_BASE_URI ||
    import.meta.env.TOGGLY_DEFINITIONS_URL;
  const metricsBaseUrl =
    runtime?.TOGGLY_METRICS_BASE_URL?.trim() ||
    import.meta.env.TOGGLY_METRICS_BASE_URL;

  return {
    appKey,
    environment,
    definitionsBaseUri,
    metricsBaseUrl,
  };
}
