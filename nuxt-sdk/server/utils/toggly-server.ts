import {
  getServerToggly,
  initServerToggly,
  type TogglyClient,
} from '@ops-ai/nuxt-toggly-server'

/** The serializable subset the Nuxt module puts in public runtime config. */
type TogglyRuntimeConfig = {
  appKey?: string
  environment?: string
  baseUri?: string
  identity?: string
  groups?: string[]
  claims?: Record<string, unknown>
  featureDefaults?: Record<string, boolean>
  enableLiveUpdates?: boolean
  enableUsageTracking?: boolean
  enableMetrics?: boolean
  serverCache?: boolean
  serverCacheTtl?: number
}

// Nuxt 4 dev rebuilds Nitro modules independently. Keep one in-flight promise
// so parallel first requests cannot race to construct two shared clients.
let pendingInitialization: Promise<TogglyClient> | undefined

/**
 * Ensure a server client exists before a route calls useEventToggly(). The Nuxt
 * module normally initializes it through its Nitro plugin. This small guard
 * covers Nuxt 4 dev's first-request ordering, while reusing the exact published
 * server initializer and configuration rather than creating another evaluator.
 */
export async function ensureServerToggly(
  config: TogglyRuntimeConfig,
): Promise<TogglyClient | null> {
  if (!config.appKey) {
    return null
  }

  const existing = getServerToggly()
  if (existing) {
    return existing
  }

  pendingInitialization ??= initServerToggly({
    appKey: config.appKey,
    environment: config.environment,
    baseUri: config.baseUri,
    identity: config.identity,
    groups: config.groups ? [...config.groups] : undefined,
    claims: config.claims ? { ...config.claims } : undefined,
    featureDefaults: config.featureDefaults,
    // Keep parity with the module's server plugin: the client refreshes over
    // live updates, not one HTTP polling timer per request.
    refreshInterval: 0,
    enableLiveUpdates: config.enableLiveUpdates,
    enableUsageTracking: config.enableUsageTracking,
    enableMetrics: config.enableMetrics,
    cache: config.serverCache,
    cacheTtl: config.serverCacheTtl,
  })

  try {
    return await pendingInitialization
  } finally {
    // Once initialized, getServerToggly() answers subsequent calls. If startup
    // ever rejects, clearing this promise lets a later request retry cleanly.
    pendingInitialization = undefined
  }
}
