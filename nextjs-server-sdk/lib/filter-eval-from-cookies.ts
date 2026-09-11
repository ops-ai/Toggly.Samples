import { cookies } from 'next/headers'
import { getRequestIdentity } from './identity'
import {
  FILTER_CLAIMS_COOKIE,
  FILTER_COUNTRY_COOKIE,
  FILTER_LANG_COOKIE,
  FILTER_UA_COOKIE,
  FILTER_VIP_COOKIE,
  parseClaimsPreset,
  parseVipCookie,
  type FilterEvalCookieBag,
} from './filter-eval-cookies'
import { buildFilterEvalOptions } from './filter-eval-options'
import type { FeatureCheckOptions } from '@ops-ai/nextjs-toggly-server'

export async function readFilterEvalCookieBag(): Promise<FilterEvalCookieBag> {
  const store = await cookies()
  const identity = await getRequestIdentity()

  function raw(name: string): string | undefined {
    const value = store.get(name)?.value
    if (!value) return undefined
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  // No VIP cookie starts this demonstration with the VIP fixture. An explicit
  // 0 remains false; missing input and a deliberate non-match are different.
  const vipRaw = raw(FILTER_VIP_COOKIE)
  return {
    identity,
    claimsPreset: parseClaimsPreset(raw(FILTER_CLAIMS_COOKIE)),
    country: raw(FILTER_COUNTRY_COOKIE),
    userAgent: raw(FILTER_UA_COOKIE),
    acceptLanguage: raw(FILTER_LANG_COOKIE),
    vip: vipRaw !== undefined ? parseVipCookie(vipRaw) : true,
  }
}

export async function readFilterEvalOptions(): Promise<FeatureCheckOptions> {
  return buildFilterEvalOptions(await readFilterEvalCookieBag())
}
