/**
 * Nuxt loads a project-root .env file before evaluating nuxt.config.ts for
 * `nuxt dev` and `nuxt build`. Keeping this small adapter separate makes the
 * hand-off from that supported loading convention to the Toggly module
 * explicit and testable.
 */
export function createTogglyModuleOptions(
  env: Record<string, string | undefined> = process.env,
) {
  const appKey = env.TOGGLY_APP_KEY?.trim() ?? ''
  return {
    appKey,
    environment: env.TOGGLY_ENVIRONMENT?.trim() || 'Production',
    baseUri: env.TOGGLY_BASE_URI?.trim() || 'https://definitions.toggly.io',
    metricsBaseUrl: env.TOGGLY_METRICS_BASE_URL?.trim() || 'https://metrics.toggly.io',
    featureDefaults: {
      // Every new behavior remains off until Toggly returns a definition.
      'new-dashboard': false,
      'api-v2': false,
      'enhanced-submit': false,
      ExpressCheckout: false,
      'beta-access': false,
    },
    // The module uses the same definition contract on SSR/Nitro and in Vue.
    ssr: true,
    persistFeatures: false,
    enableLiveUpdates: env.TOGGLY_ENABLE_LIVE_UPDATES !== 'false',
    // Browser telemetry is owned by the Nuxt client, never by Nitro.
    enableTelemetry: Boolean(appKey) && env.TOGGLY_ENABLE_TELEMETRY !== 'false',
    enableUsageTracking: true,
    enableMetrics: true,
    // The server can evaluate flags without emitting optional telemetry.
    serverEnableUsageTracking: false,
    serverEnableMetrics: false,
  }
}
