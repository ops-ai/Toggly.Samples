import type { TogglyEntityContext, TogglyOptions } from '@ops-ai/react-feature-flags-toggly'

export const SESSION_IDENTITY_KEY = 'toggly-react-sample.identity'

/**
 * Defaults are deliberately false. A missing key, an offline browser, or a
 * first load must not accidentally expose a feature just because the sample
 * UI has not received its evaluated definitions yet.
 */
export const featureDefaults = {
  'new-dashboard': false,
  'api-v2': false,
  'enhanced-submit': false,
  ExpressCheckout: false,
  'beta-access': false,
  'filter-always-on': false,
  'filter-percentage': false,
  'filter-targeting': false,
  'filter-user-claims': false,
  'filter-time-window': false,
  'filter-country': false,
  'filter-browser-family': false,
  'filter-browser-language': false,
  'filter-device-type': false,
  'filter-os': false,
  'filter-context-property': false,
} as const

export type Order = {
  id: string
  vip: boolean
  total?: number
}

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Keep a stable identity for this browser tab. We pass it to provider creation
 * so the first definition request already carries the identity; setContext is
 * reserved for a later login/logout transition.
 */
export function createSessionIdentity(storage: SessionStorageLike): string {
  const existing = storage.getItem(SESSION_IDENTITY_KEY)
  if (existing) return existing

  const randomPart =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const identity = `sample-${randomPart}`
  storage.setItem(SESSION_IDENTITY_KEY, identity)
  return identity
}

/**
 * Entity conditions are evaluated at the callsite, not added to the user's
 * global context. That lets one page safely render a VIP and a standard order
 * side by side with independent ExpressCheckout decisions.
 */
export function mapOrderContext(order: Order): TogglyEntityContext {
  return {
    kind: 'Order',
    key: order.id,
    attributes: {
      Id: order.id,
      Vip: order.vip,
      ...(order.total === undefined ? {} : { Total: order.total }),
    },
  }
}

/**
 * The provider can run without an app key for the missing-key walkthrough.
 * In that mode it has only false defaults and no remote polling/WebSocket,
 * making the configuration error visible without issuing malformed requests.
 */
export function createProviderOptions(
  rawAppKey: string | undefined,
  environment: string,
  identity: string,
): TogglyOptions {
  const appKey = rawAppKey?.trim()
  const remoteOptions = appKey ? { appKey, enableLiveUpdates: true } : {
    enableLiveUpdates: false,
    persistCache: false,
  }

  return {
    ...remoteOptions,
    environment,
    identity,
    enableVariants: true,
    featureDefaults,
    onError: (message, error) => {
      // A sample should surface the error in DevTools without crashing its UI.
      console.warn(`[Toggly React sample] ${message}`, error)
    },
  }
}
