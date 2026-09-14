/**
 * Nuxt loads a project-root .env file before evaluating nuxt.config.ts for
 * `nuxt dev` and `nuxt build`. Keeping this small adapter separate makes the
 * hand-off from that supported loading convention to the Toggly module
 * explicit and testable.
 */
export function createTogglyModuleOptions(
  env: Record<string, string | undefined> = process.env,
) {
  return {
    appKey: env.TOGGLY_APP_KEY?.trim() ?? '',
    environment: env.TOGGLY_ENVIRONMENT?.trim() || 'Production',
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
    enableLiveUpdates: true,
  }
}
