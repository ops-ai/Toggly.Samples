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

  const existing = getServerToggly()
  if (existing) {
    if (!orderRegistered) {
      registerOrderContext(existing)
      orderRegistered = true
    }
    return existing
  }

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
