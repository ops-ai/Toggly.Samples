import { fileURLToPath } from 'node:url'
import type { IdentityContext } from '@ops-ai/remix-toggly-core'

type ServerPackage = {
  createTogglyLoader: (options: Record<string, unknown>) => any
  createTogglyAction: (options: Record<string, unknown>) => any
}
let serverPackage: Promise<ServerPackage> | undefined

async function publishedServer(): Promise<ServerPackage> {
  if (!serverPackage) {
    serverPackage = (async () => {
      // remix-toggly-core 1.9.0's telemetry ESM entry falls back to
      // __filename. Node ESM has no binding, so scope the published module's
      // own path only while it initializes; this does not affect user context.
      const moduleGlobal = globalThis as typeof globalThis & { __filename?: string }
      const previous = moduleGlobal.__filename
      moduleGlobal.__filename = fileURLToPath(import.meta.resolve('@ops-ai/remix-toggly-core/telemetry/grpc'))
      try { return await import('@ops-ai/remix-toggly-server') as ServerPackage }
      finally { if (previous === undefined) Reflect.deleteProperty(moduleGlobal, '__filename'); else moduleGlobal.__filename = previous }
    })()
  }
  return serverPackage
}

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
  const identity = cookie.match(/(?:^|;\\s*)toggly-identity=([^;]+)/)?.[1]
  const country = request.headers.get('cf-ipcountry') || undefined
  return {
    identity: identity ? decodeURIComponent(identity) : undefined,
    claims: { role: request.headers.get('x-demo-role') || 'user' },
    request: {
      country,
      userAgent: request.headers.get('user-agent') || undefined,
      acceptLanguage: request.headers.get('accept-language') || undefined,
    },
  }
}

/** The documented Remix server surface, configured for local rule evaluation. */
export async function sampleLoader() {
  return (await publishedServer()).createTogglyLoader(sampleOptions())
}

export async function sampleAction() {
  return (await publishedServer()).createTogglyAction(sampleOptions())
}

function sampleOptions() {
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
