import { getCookie, getHeader, getQuery, type H3Event } from 'h3'
import { defaultIdentityForPreset, isDemoPreset, orderForPreset, type DemoPreset } from '../../lib/demo'

/**
 * The controls in this sample intentionally use a cookie and query preset.
 * They make filter outcomes repeatable without pretending that headers and
 * query values are authentication. Replace every extractor with trusted
 * session/user data in a production application.
 */
export function getDemoPreset(event: H3Event): DemoPreset {
  const preset = getQuery(event).preset
  return isDemoPreset(preset) ? preset : 'matching'
}

export function getDemoOrder(event: H3Event) {
  return orderForPreset(getDemoPreset(event))
}

export function getDemoEvalContext(event: H3Event) {
  const preset = getDemoPreset(event)
  // A browser session identity wins for either preset. The preset still owns
  // the demonstration defaults and all non-identity filter inputs.
  const identity = getCookie(event, 'demo-identity') || defaultIdentityForPreset(preset)

  if (preset === 'matching') {
    return {
      identity,
      groups: ['beta'],
      claims: { role: 'admin' },
      request: {
        country: 'US',
        acceptLanguage: 'en-US,en;q=0.9',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    }
  }

  return {
    identity,
    groups: ['users'],
    claims: { role: 'user' },
    request: {
      country: 'CA',
      acceptLanguage: 'fr-FR,fr;q=0.9',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      // A real request has an actual user-agent and country header. The preset
      // overrides them only so this catalogue page is deterministic.
      originalUserAgent: getHeader(event, 'user-agent') || undefined,
    },
  }
}
