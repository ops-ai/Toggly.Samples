/**
 * Nuxt loads this configuration once at startup. The Toggly Nuxt module then
 * creates its browser and Nitro integrations from it.
 *
 * The app key identifies this Toggly application; it is not a user credential.
 * Keep it in a local environment file so a forked sample does not accidentally
 * point at somebody else's application. Nuxt exposes module configuration to
 * the browser because the browser client must fetch public flag definitions.
 */
const appKey = process.env.TOGGLY_APP_KEY ?? ''

export default defineNuxtConfig({
  modules: ['@ops-ai/nuxt-toggly'],

  toggly: {
    appKey,
    environment: process.env.TOGGLY_ENVIRONMENT ?? 'Production',

    // These safe fallbacks make missing-key and unavailable states useful:
    // every new behavior stays off until Toggly returns a definition.
    featureDefaults: {
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
  },

  compatibilityDate: '2026-09-13',
})
