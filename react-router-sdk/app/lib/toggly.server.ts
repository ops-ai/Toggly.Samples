import type { IdentityContext, ServerFeatureContext, TogglyLoaderOptions } from '@ops-ai/react-router-toggly/server'
import { createTogglyAction, createTogglyLoader } from '@ops-ai/react-router-toggly/server'

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
  const encodedIdentity = cookie.match(/(?:^|;\s*)toggly-identity=([^;]+)/)?.[1]
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

/** The documented React Router server surface, configured for local rule evaluation. */
export function sampleLoader() {
  return createTogglyLoader(sampleOptions())
}

export function sampleAction() {
  return createTogglyAction(sampleOptions())
}

export function sampleOptions(): TogglyLoaderOptions {
  return {
    appKey: APP_KEY,
    environment: ENVIRONMENT,
    evaluationMode: 'local',
    timeout: 4000,
    getContext: requestContext,
    // Sample output should explain a failed refresh rather than crash a route.
    onError: (message: string) => console.warn(`[React Router SDK sample] ${message}`),
    // Avoid attaching process signal handlers on every request-scoped client.
    telemetryAttachProcessHandlers: false,
  }
}

export function hasServerKey(): boolean {
  return Boolean(APP_KEY)
}

/** Drop the server app key before any payload is serialized into HTML. */
export function publicServerContext(context: ServerFeatureContext): ServerFeatureContext {
  const { appKey: _appKey, ...safe } = context
  return safe
}
