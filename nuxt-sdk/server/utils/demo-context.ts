import { getCookie, getHeader, getQuery, type H3Event } from 'h3'
import { defaultIdentityForPreset, isDemoPreset, orderForPreset, type DemoPreset } from '../../lib/demo'

function normalizePreset(raw: string | undefined | null): DemoPreset | null {
  if (!raw) return null
  if (raw === 'matching') return 'matching'
  if (raw === 'nonmatching' || raw === 'non-matching') return 'non-matching'
  return null
}

/**
 * Live E2E uses preset=none with x-demo-preset / sample-preset (see astro/blazor samples).
 * Query ?preset= wins when the UI explicitly navigates; otherwise headers and cookies apply.
 */
export function getDemoPreset(event: H3Event): DemoPreset {
  const queryPreset = getQuery(event).preset
  if (typeof queryPreset === 'string' && queryPreset !== '' && queryPreset !== 'none') {
    return isDemoPreset(queryPreset) ? queryPreset : 'matching'
  }

  const fromHarness =
    normalizePreset(getHeader(event, 'x-demo-preset')) ??
    normalizePreset(getCookie(event, 'sample-preset')) ??
    normalizePreset(getCookie(event, 'toggly-preset'))

  return fromHarness ?? 'matching'
}

export function getDemoOrder(event: H3Event) {
  return orderForPreset(getDemoPreset(event))
}

export function getDemoEvalContext(event: H3Event) {
  const preset = getDemoPreset(event)
  const harnessIdentity = getHeader(event, 'x-toggly-identity')?.trim()
  const cookieIdentity = getCookie(event, 'demo-identity')?.trim()
  const identity =
    harnessIdentity ||
    cookieIdentity ||
    defaultIdentityForPreset(preset)

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
      originalUserAgent: getHeader(event, 'user-agent') || undefined,
    },
  }
}
