import { evaluateEventFeatureGate, isEventFeatureOn, useEventToggly } from '@ops-ai/nuxt-toggly-server'
import { getDemoOrder } from '../utils/demo-context'
import { ensureServerToggly } from '../utils/toggly-server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig().public.toggly as { appKey?: string }
  if (!config.appKey) {
    return { source: 'defaults', newDashboard: false, apiV2: false, anyGate: false }
  }

  // Helpers resolve the request's ambient context registered in the plugin.
  // They never call a process-wide setIdentity method.
  await ensureServerToggly(config)
  return {
    source: 'live',
    newDashboard: await isEventFeatureOn(event, 'new-dashboard'),
    apiV2: await isEventFeatureOn(event, 'api-v2'),
    anyGate: await evaluateEventFeatureGate(
      event,
      ['new-dashboard', 'api-v2'],
      'any',
    ),
    expressCheckout: await useEventToggly(event).isFeatureOn(
      'ExpressCheckout',
      getDemoOrder(event),
      'Order',
    ),
  }
})
