import { defineFeatureHandler } from '@ops-ai/nuxt-toggly-server'
import { ensureServerToggly } from '../utils/toggly-server'

/**
 * Nuxt-specific route protection: the handler body runs only when beta-access
 * is enabled for this H3 event. The wrapper has the same request-scoped context
 * as the rest of the server helpers.
 */
const betaHandler = defineFeatureHandler('beta-access', async () => ({
  message: 'This payload is protected by defineFeatureHandler(beta-access).',
}))

export default defineEventHandler(async (event) => {
  await ensureServerToggly(useRuntimeConfig().public.toggly)
  return betaHandler(event)
})
