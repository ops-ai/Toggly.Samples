import { configureEventEvalContext } from '@ops-ai/nuxt-toggly-server'
import { getDemoEvalContext } from '../utils/demo-context'

/**
 * Register extractors, not a user's identity. Nitro calls these functions for
 * every H3 event and caches the resulting context on that event only. That
 * avoids leaking one request's identity into another long-lived Node request.
 */
export default defineNitroPlugin(() => {
  configureEventEvalContext({
    getContext: getDemoEvalContext,
  })
})
