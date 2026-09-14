/**
 * Shared, non-secret sample data. These names match docs/FLAG_TEMPLATE.md so a
 * reader can create one Toggly application and exercise every page here.
 */
export const demoFlags = [
  'new-dashboard',
  'api-v2',
  'enhanced-submit',
  'ExpressCheckout',
  'beta-access',
] as const

export const filterFlags = [
  'filter-always-on',
  'filter-percentage',
  'filter-targeting',
  'filter-user-claims',
  'filter-time-window',
  'filter-country',
  'filter-browser-family',
  'filter-browser-language',
  'filter-device-type',
  'filter-os',
  'filter-context-property',
] as const

export const allFlagKeys = [...demoFlags, ...filterFlags]

export type DemoPreset = 'matching' | 'non-matching'

/**
 * This is the SDK's canonical entity shape. The dashboard's Order context
 * schema has properties Id, Vip and Total; key carries Id while attributes
 * carries the other properties for evaluation.
 */
export type OrderContext = {
  kind: 'Order'
  key: string
  attributes: {
    Vip: boolean
    Total?: number
  }
}

export function orderForPreset(preset: DemoPreset): OrderContext {
  return preset === 'matching'
    ? { kind: 'Order', key: 'ord-vip', attributes: { Vip: true, Total: 250 } }
    : { kind: 'Order', key: 'ord-standard', attributes: { Vip: false, Total: 40 } }
}

/** The session-free identity used by each reproducible filter preset. */
export function defaultIdentityForPreset(preset: DemoPreset) {
  return preset === 'matching' ? 'alice' : 'bob'
}

export const filterDescriptions: Record<(typeof filterFlags)[number], string> = {
  'filter-always-on': 'AlwaysOn has no request input and stays enabled.',
  'filter-percentage': '50% rollout uses a stable identity bucket; a preset does not promise ON.',
  'filter-targeting': 'Targeting matches identity alice.',
  'filter-user-claims': 'UserClaims matches role=admin.',
  'filter-time-window': 'The open 2020–2099 window matches both presets.',
  'filter-country': 'Country matches US.',
  'filter-browser-family': 'BrowserFamily matches Chrome.',
  'filter-browser-language': 'BrowserLanguage includes en.',
  'filter-device-type': 'DeviceType matches Macintosh.',
  'filter-os': 'OperatingSystem matches Mac.',
  'filter-context-property': 'ContextProperty matches Order.Vip=true.',
}

export function isDemoPreset(value: unknown): value is DemoPreset {
  return value === 'matching' || value === 'non-matching'
}
