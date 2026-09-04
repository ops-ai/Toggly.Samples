export const FILTER_CLAIMS_COOKIE = 'toggly-filter-claims'
export const FILTER_COUNTRY_COOKIE = 'toggly-filter-country'
export const FILTER_UA_COOKIE = 'toggly-filter-ua'
export const FILTER_LANG_COOKIE = 'toggly-filter-lang'
export const FILTER_VIP_COOKIE = 'toggly-filter-vip'

export type ClaimsPreset = 'admin' | 'user' | 'none'

export type FilterEvalCookieBag = {
  identity?: string
  claimsPreset?: ClaimsPreset
  country?: string
  userAgent?: string
  acceptLanguage?: string
  vip?: boolean
}

export function claimsFromPreset(
  preset: ClaimsPreset | undefined,
): Record<string, string> | undefined {
  if (preset === 'admin') return { role: 'admin' }
  if (preset === 'user') return { role: 'user' }
  return undefined
}

export function parseClaimsPreset(raw: string | undefined): ClaimsPreset {
  if (raw === 'admin' || raw === 'user') return raw
  return 'none'
}

export function parseVipCookie(raw: string | undefined): boolean {
  return raw === '1' || raw === 'true'
}
