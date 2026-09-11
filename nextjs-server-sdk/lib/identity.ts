import { cookies } from 'next/headers'

export const TOGGLY_IDENTITY_COOKIE = 'toggly-identity'

/**
 * Read the sample identity cookie for per-call checks.
 * Never assign this onto the shared server client.
 */
// Identity is a targeting key (for example alice), not authentication. One Node
// process can serve many users at once, so the cookie is read per request and
// passed per evaluation. Clearing it omits the override; SDK defaults may apply.
export async function getRequestIdentity(): Promise<string | undefined> {
  const cookieStore = await cookies()
  const value = cookieStore.get(TOGGLY_IDENTITY_COOKIE)?.value
  if (!value) return undefined
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
