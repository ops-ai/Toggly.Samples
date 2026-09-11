import {
  initServerToggly,
  getServerToggly,
  type TogglyClient,
} from '@ops-ai/nextjs-toggly-server'
import { registerOrderContext } from './order-context'
import { getTogglyAppKey, getTogglyEnvironment } from './env'

let orderRegistered = false

/**
 * Sole owner of initServerToggly + registerOrderContext.
 * Safe to call from layout, Server Actions, and Route Handlers.
 *
 * Does not accept per-request identity — pass identity on each check
 * via helpers / component props so concurrent requests cannot overwrite
 * a process-wide client.identity.
 *
 * Live updates come from the server SDK WebSocket (enableLiveUpdates).
 */
export async function initSampleToggly(): Promise<TogglyClient | null> {
  const appKey = getTogglyAppKey()
  if (!appKey) {
    return null
  }

  // Reuse loaded definitions and the live connection across requests. Registering
  // a mapper is application setup; choosing a user or Order is request data.
  const existing = getServerToggly()
  if (existing) {
    if (!orderRegistered) {
      registerOrderContext(existing)
      orderRegistered = true
    }
    return existing
  }

  // Published server SDK evaluates full definitions locally. Its defaults enable
  // WebSocket updates and disable interval polling; await setup before checks.
  // No featureDefaults are supplied here: unknown flags evaluate false. A failed
  // refresh can retain previous definitions, so inspect errors as well as flags.
  const client = await initServerToggly({
    appKey,
    environment: getTogglyEnvironment(),
    onError: (message, error) => {
      console.warn('[Toggly sample]', message, error)
    },
  })

  registerOrderContext(client)
  orderRegistered = true
  return client
}
