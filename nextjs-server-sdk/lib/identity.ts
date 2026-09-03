import { cookies } from 'next/headers'

export const TOGGLY_IDENTITY_COOKIE = 'toggly-identity'

/**
 * Read the sample identity cookie for per-call checks.
 * Never assign this onto the shared server client.
 */
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
