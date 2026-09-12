export const sections = [
  'home',
  'declarative',
  'programmatic',
  'identity',
  'entity',
  'filters',
  'framework',
];
// These booleans make the keyless demonstration usable. They are fallback values,
// not a substitute for the live Production environment when keys are configured.
export const defaults = {
  'new-dashboard': true,
  'api-v2': false,
  'enhanced-submit': true,
  'beta-access': true,
};
// Node filters use flattened, indexed parameter names. Copy these native names
// when configuring the matching FLAG_TEMPLATE rules; frontend snapshots are
// evaluated separately and never receive this raw rule catalog.
export const filters = [
  { featureKey: 'filter-always-on', filters: [{ name: 'AlwaysOn' }] },
  // Percentage is identity-sticky: switching presets does not prescribe its result.
  {
    featureKey: 'filter-percentage',
    filters: [{ name: 'Percentage', parameters: { Value: 50 } }],
  },
  // The :0 suffix is the first entry in the Targeting user list.
  {
    featureKey: 'filter-targeting',
    filters: [{ name: 'Targeting', parameters: { 'Audience.Users:0': 'alice' } }],
  },
  // Segment Percentage=100 makes the claim condition the deciding factor.
  {
    featureKey: 'filter-user-claims',
    filters: [
      {
        name: 'UserClaims',
        parameters: { Claim: 'role', Value: 'admin', Percentage: 100 },
      },
    ],
  },
  {
    featureKey: 'filter-time-window',
    filters: [
      {
        name: 'TimeWindow',
        parameters: {
          Start: '2020-01-01T00:00:00Z',
          End: '2099-12-31T23:59:59Z',
        },
      },
    ],
  },
  // Request segment rules also use indexed values and explicit Percentage=100.
  {
    featureKey: 'filter-country',
    filters: [{ name: 'Country', parameters: { 'Country:0': 'US', Percentage: 100 } }],
  },
  {
    featureKey: 'filter-browser-family',
    filters: [
      {
        name: 'BrowserFamily',
        parameters: { 'BrowserFamily:0': 'Chrome', Percentage: 100 },
      },
    ],
  },
  {
    featureKey: 'filter-browser-language',
    filters: [
      {
        name: 'BrowserLanguage',
        parameters: { 'BrowserLanguage:0': 'en', Percentage: 100 },
      },
    ],
  },
  {
    featureKey: 'filter-device-type',
    filters: [
      {
        name: 'DeviceType',
        parameters: { 'DeviceType:0': 'Macintosh', Percentage: 100 },
      },
    ],
  },
  {
    featureKey: 'filter-os',
    filters: [
      {
        name: 'OperatingSystem',
        parameters: { 'OperatingSystem:0': 'Mac', Percentage: 100 },
      },
    ],
  },
  // Bind the flag to Order in the dashboard. Vip is read from the entity
  // supplied to each evaluation, not from a process-wide current order.
  {
    featureKey: 'filter-context-property',
    contextKind: 'Order',
    filters: [
      {
        name: 'ContextProperty',
        parameters: { Property: 'Vip', Operator: 'eq', Value: 'true' },
      },
    ],
  },
];
export const matchingAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export const nonMatchingAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
// These controlled inputs reproduce the shared filter matrix. Real applications
// obtain identity/claims from their session and request headers from trusted ingress.
export function preset(matching: boolean) {
  return {
    identity: matching ? 'alice' : 'bob',
    groups: matching ? ['beta'] : [],
    claims: { role: matching ? 'admin' : 'user' },
    request: {
      country: matching ? 'US' : 'CA',
      acceptLanguage: matching ? 'en-US,en;q=0.9' : 'fr-FR,fr;q=0.9',
      userAgent: matching ? matchingAgent : nonMatchingAgent,
    },
  };
}
// Map each domain order to an explicit kind/key/attributes object. Matching the
// schema key and property types matters: Vip is a boolean, not the string "true".
export const vip = {
  kind: 'Order',
  key: 'ord-vip',
  attributes: { Id: 'ord-vip', Vip: true, Total: 150 },
};
export const standard = {
  kind: 'Order',
  key: 'ord-standard',
  attributes: { Id: 'ord-standard', Vip: false, Total: 20 },
};
