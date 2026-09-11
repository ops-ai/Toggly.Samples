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
  // These are simulated request headers for local evaluation, not outgoing HTTP
  // headers. Country uses the same cf-ipcountry name as a trusted edge proxy;
  // here its value is deliberately user-editable so both rule branches are visible.
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
      // Supply the domain object, not { Vip: ... }: registerOrderContext maps
      // its lower-case fields to the exact attribute names in the Toggly rule.
      options.context = order
      options.contextKind = 'Order'
    }
  }

  return options
}
