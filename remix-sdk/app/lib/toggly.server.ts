import type { IdentityContext } from '@ops-ai/remix-toggly-core'
import {
  createTogglyAction,
  createTogglyLoader,
  type TogglyLoaderOptions,
} from '@ops-ai/remix-toggly-server'

export const APP_KEY = process.env.TOGGLY_APP_KEY
export const ENVIRONMENT = process.env.TOGGLY_ENVIRONMENT || 'Production'
export const IDENTITY_COOKIE = 'toggly-identity'

/**
 * Build request inputs once for every loader/action. The SDK stores this in its
 * async request scope; it never changes a process-wide client identity.
 * Cookie values are a teaching aid only, not authentication or authorization.
 */
export function requestContext(request: Request): IdentityContext {
  const cookie = request.headers.get('cookie') || ''
  const encodedIdentity = cookie.match(/(?:^|;\\s*)toggly-identity=([^;]+)/)?.[1]
  const country = request.headers.get('cf-ipcountry') || undefined
  return {
    // A malformed browser cookie must not turn an otherwise valid request into
    // a 500 response. Treat it as an absent demo identity and continue.
    identity: decodeIdentityCookie(encodedIdentity),
    claims: { role: request.headers.get('x-demo-role') || 'user' },
    request: {
      country,
      userAgent: request.headers.get('user-agent') || undefined,
      acceptLanguage: request.headers.get('accept-language') || undefined,
    },
  }
}

function decodeIdentityCookie(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

/** The documented Remix server surface, configured for local rule evaluation. */
export function sampleLoader() {
  return createTogglyLoader(sampleOptions())
}

export function sampleAction() {
  return createTogglyAction(sampleOptions())
}

function sampleOptions(): TogglyLoaderOptions {
  return {
    appKey: APP_KEY,
    environment: ENVIRONMENT,
    evaluationMode: 'local',
    getContext: requestContext,
    // Sample output should explain a failed refresh rather than crash a route.
    onError: (message: string) => console.warn(`[Remix SDK sample] ${message}`),
  }
}

export function hasServerKey(): boolean {
  return Boolean(APP_KEY)
}
