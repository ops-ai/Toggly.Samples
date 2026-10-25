/**
 * Live E2E builds the SSR bundle without secrets, then starts the Node server
 * with TOGGLY_* in process.env. Prefer runtime env over Vite-inlined import.meta.env.
 */
export function readTogglyRuntimeEnv() {
  const runtime = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;

  const appKey = runtime?.TOGGLY_APP_KEY?.trim() || import.meta.env.TOGGLY_APP_KEY;
  const environment =
    runtime?.TOGGLY_ENVIRONMENT?.trim() ||
    import.meta.env.TOGGLY_ENVIRONMENT ||
    'Production';
  const definitionsBaseUri =
    runtime?.TOGGLY_DEFINITIONS_BASE_URI?.trim() ||
    import.meta.env.TOGGLY_DEFINITIONS_BASE_URI;
  const metricsBaseUrl =
    runtime?.TOGGLY_METRICS_BASE_URL?.trim() ||
    import.meta.env.TOGGLY_METRICS_BASE_URL;

  return {
    appKey: appKey && appKey.length > 0 ? appKey : undefined,
    environment,
    definitionsBaseUri,
    metricsBaseUrl,
  };
}
