import {
  evaluateEventFeatureGate,
  useEventToggly,
} from '@ops-ai/nuxt-toggly-server'
import { allFlagKeys, filterDescriptions } from '../../lib/demo'
import { getDemoEvalContext, getDemoOrder, getDemoPreset } from '../utils/demo-context'
import { ensureServerToggly } from '../utils/toggly-server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig().public.toggly as { appKey?: string }
  const preset = getDemoPreset(event)
  const order = getDemoOrder(event)

  // A missing application key is a normal onboarding state. Do not initialize
  // or call the server SDK; return the same safe-off snapshot the UI explains.
  if (!config.appKey) {
    return {
      source: 'defaults',
      preset,
      identity: getDemoEvalContext(event).identity,
      order,
      flags: Object.fromEntries(allFlagKeys.map((key) => [key, false])),
      allGate: false,
      expressCheckout: false,
      filterDescriptions,
    }
  }

  // This awaits the published SDK initializer if Nuxt dev has not finished the
  // module plugin yet. It is idempotent and does not touch request identity.
  await ensureServerToggly(config)
  const toggly = useEventToggly(event)
  const flags = Object.fromEntries(
    await Promise.all(
      allFlagKeys.map(async (key) => [
        key,
        await toggly.isFeatureOn(
          key,
          key === 'ExpressCheckout' || key === 'filter-context-property'
            ? order
            : undefined,
          key === 'ExpressCheckout' || key === 'filter-context-property'
            ? 'Order'
            : undefined,
        ),
      ]),
    ),
  )

  return {
    source: 'live',
    preset,
    identity: getDemoEvalContext(event).identity,
    order,
    flags,
    allGate: await evaluateEventFeatureGate(
      event,
      ['new-dashboard', 'api-v2'],
      'all',
    ),
    expressCheckout: flags.ExpressCheckout,
    filterDescriptions,
  }
})
