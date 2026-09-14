import { configureEventEvalContext } from '@ops-ai/nuxt-toggly-server'
import { ensureServerToggly } from '../utils/toggly-server'
import { getDemoEvalContext } from '../utils/demo-context'

/**
 * Register extractors, not a user's identity. Nitro calls these functions for
 * every H3 event and caches the resulting context on that event only. That
 * avoids leaking one request's identity into another long-lived Node request.
 */
export default defineNitroPlugin(async () => {
  configureEventEvalContext({
    getContext: getDemoEvalContext,
  })

  // Nuxt 4 dev can serve the first route while module plugins are still being
  // rebuilt. Eager initialization covers the normal path; route-level guards
  // repeat the idempotent check for a hot-reload first request.
  await ensureServerToggly(useRuntimeConfig().public.toggly)
})
