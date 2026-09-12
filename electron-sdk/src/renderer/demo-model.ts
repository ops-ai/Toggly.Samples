export const coreFlags = [
  'new-dashboard',
  'api-v2',
  'enhanced-submit',
  'ExpressCheckout',
  'beta-access',
] as const

export const filterFlags = [
  'filter-always-on', 'filter-percentage', 'filter-targeting', 'filter-user-claims',
  'filter-time-window', 'filter-country', 'filter-browser-family',
  'filter-browser-language', 'filter-device-type', 'filter-os', 'filter-context-property',
] as const

export type PresetName = 'matching' | 'non-matching'

export function buildOrderContext(vip: boolean): {
  kind: 'Order'
  key: string
  attributes: { Id: string; Vip: boolean; Total: number }
} {
  const key = vip ? 'ord-vip' : 'ord-standard'
  return {
    // normalizeEntityContext accepts this published entity contract directly.
    // `key` identifies the context instance; the dashboard rule reads Vip from
    // attributes, which is why both names are kept in this teaching example.
    kind: 'Order',
    key,
    attributes: { Id: key, Vip: vip, Total: vip ? 199 : 49 },
  }
}

export function filterPreset(name: PresetName) {
  return name === 'matching'
    ? { identity: 'alice', role: 'admin', country: 'US', language: 'en-US,en;q=0.9', browser: 'Chrome on macOS', vip: true }
    : { identity: 'bob', role: 'user', country: 'CA', language: 'fr-FR,fr;q=0.9', browser: 'Firefox on Windows', vip: false }
}

export function missingKeyMessage(appKey: string): string | null {
  if (!appKey) return 'No App Key: defaults are shown and the SDK makes no network request.'
  if (appKey === 'ci-placeholder') return 'A CI placeholder is present: it is intentionally not a live App Key.'
  return null
}

/**
 * getFlags() is a context-free snapshot. ContextProperty is different: the
 * selected Order must accompany its own evaluation, so use that result here.
 */
export function filterResult(
  key: string,
  snapshot: Record<string, boolean>,
  contextPropertyResult: boolean,
): boolean {
  return key === 'filter-context-property'
    ? contextPropertyResult
    : (snapshot[key] ?? false)
}

// Electron's public bridge can update identity, groups, and claims. It has no
// request-header argument, so country, browser family/language/device/OS cannot
// be truthfully emulated by the two desktop presets.
export const filterCapabilities = [
  ['filter-always-on', 'Evaluated without contextual input', 'Supported'],
  ['filter-percentage', 'Stable identity', 'Supported'],
  ['filter-targeting', 'Identity', 'Supported'],
  ['filter-user-claims', 'Claims', 'Supported'],
  ['filter-time-window', 'Current time', 'Supported'],
  ['filter-country', 'HTTP country header', 'Not exposed by Electron bridge'],
  ['filter-browser-family', 'HTTP user-agent', 'Not exposed by Electron bridge'],
  ['filter-browser-language', 'HTTP Accept-Language', 'Not exposed by Electron bridge'],
  ['filter-device-type', 'HTTP user-agent', 'Not exposed by Electron bridge'],
  ['filter-os', 'HTTP user-agent', 'Not exposed by Electron bridge'],
  ['filter-context-property', 'Order.Vip', 'Supported per evaluation'],
] as const
