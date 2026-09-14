export type FilterRow = {
  key: string
  input: string
  matching: string
  nonMatching: string
  limitation?: string
}

/**
 * This table mirrors docs/FLAG_TEMPLATE.md. The React browser SDK sends
 * identity, groups, and claims in its evaluated-definitions request. It does
 * not offer a per-call API for forging country or user-agent headers, so those
 * rows stay visible and explain what the browser/network actually supplies.
 */
export const filterRows: FilterRow[] = [
  {
    key: 'filter-always-on',
    input: 'No input',
    matching: 'on',
    nonMatching: 'on',
  },
  {
    key: 'filter-percentage',
    input: 'Identity',
    matching: 'sticky result for alice',
    nonMatching: 'sticky result for bob',
    limitation: 'Percentage is intentionally sticky per identity; either result can be correct.',
  },
  {
    key: 'filter-targeting',
    input: 'Identity',
    matching: 'alice → on',
    nonMatching: 'bob → off',
  },
  {
    key: 'filter-user-claims',
    input: 'claims.role',
    matching: 'admin → on',
    nonMatching: 'user → off',
  },
  {
    key: 'filter-time-window',
    input: 'Dashboard clock rule',
    matching: 'inside configured window → on',
    nonMatching: 'outside configured window → off',
    limitation: 'The time comes from the service rule; this browser demo does not override it.',
  },
  {
    key: 'filter-country',
    input: 'Network country',
    matching: 'US network → on',
    nonMatching: 'CA network → off',
    limitation: 'Country is derived by the definitions service from the network request, not a browser SDK override.',
  },
  {
    key: 'filter-browser-family',
    input: 'Browser user agent',
    matching: 'Chrome → on',
    nonMatching: 'Firefox → off',
    limitation: 'The browser supplies its own user agent; the SDK does not let an app forge it per check.',
  },
  {
    key: 'filter-browser-language',
    input: 'Browser Accept-Language',
    matching: 'English browser → on',
    nonMatching: 'French browser → off',
    limitation: 'Language comes from browser request headers; test it with a browser profile or locale, not a claim.',
  },
  {
    key: 'filter-device-type',
    input: 'Browser user agent',
    matching: 'Macintosh → on',
    nonMatching: 'Windows → off',
    limitation: 'Device type is browser-controlled user-agent data, with no per-call override in this SDK.',
  },
  {
    key: 'filter-os',
    input: 'Browser user agent',
    matching: 'Mac → on',
    nonMatching: 'Windows → off',
    limitation: 'Operating system is browser-controlled user-agent data, with no per-call override in this SDK.',
  },
  {
    key: 'filter-context-property',
    input: 'Order.Vip',
    matching: 'ord-vip / true → on',
    nonMatching: 'ord-standard / false → off',
  },
]
