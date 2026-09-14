import { createTogglyModuleOptions } from './lib/toggly-options'

/**
 * Nuxt loads project-root .env before evaluating this configuration for its
 * CLI commands. The Toggly module then creates browser and Nitro integrations
 * from these options. The app key identifies this application; it is not a
 * user credential. Nuxt exposes it because the browser fetches public flag
 * definitions, but it remains local to prevent a sample fork using your app.
 */

export default defineNuxtConfig({
  modules: ['@ops-ai/nuxt-toggly'],

  // createTogglyModuleOptions receives TOGGLY_APP_KEY loaded by Nuxt from .env.
  toggly: createTogglyModuleOptions(process.env),

  compatibilityDate: '2026-09-13',
})
