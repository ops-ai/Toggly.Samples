import type { FeatureCheckOptions } from '@ops-ai/nextjs-toggly-server'
import { getOrder } from './orders'
import {
  claimsFromPreset,
  type FilterEvalCookieBag,
} from './filter-eval-cookies'

/**
 * Build per-call FeatureCheckOptions for the filters matrix.
 * Does not mutate the shared server client.
 */
export function buildFilterEvalOptions(
  bag: FilterEvalCookieBag,
): FeatureCheckOptions {
  const headers: Record<string, string> = {}
  if (bag.country?.trim()) {
    headers['cf-ipcountry'] = bag.country.trim().toUpperCase()
  }
  if (bag.userAgent?.trim()) {
    headers['user-agent'] = bag.userAgent.trim()
  }
  if (bag.acceptLanguage?.trim()) {
    headers['accept-language'] = bag.acceptLanguage.trim()
  }

  const options: FeatureCheckOptions = {
    identity: bag.identity || undefined,
    claims: claimsFromPreset(bag.claimsPreset),
  }

  if (Object.keys(headers).length > 0) {
    options.headers = headers
  }

  if (bag.vip !== undefined) {
    const order = getOrder(bag.vip ? 'ord-vip' : 'ord-standard')
    if (order) {
      options.context = order
      options.contextKind = 'Order'
    }
  }

  return options
}
