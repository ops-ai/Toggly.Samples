/** Shared demo names from docs/FLAG_TEMPLATE.md — keep keys identical to the dashboard. */

export const demoKeys = [
  'new-dashboard',
  'api-v2',
  'enhanced-submit',
  'ExpressCheckout',
  'beta-access',
] as const;

export const filterCatalog = [
  { key: 'filter-always-on', name: 'AlwaysOn', rule: 'Always on in both presets' },
  {
    key: 'filter-percentage',
    name: 'Percentage',
    rule: '50%; sticky by identity, not a guaranteed match',
  },
  { key: 'filter-targeting', name: 'Targeting', rule: 'User alice' },
  { key: 'filter-user-claims', name: 'UserClaims', rule: 'role = admin' },
  {
    key: 'filter-time-window',
    name: 'TimeWindow',
    rule: 'Open from 2020 through 2099',
  },
  { key: 'filter-country', name: 'Country', rule: 'US' },
  { key: 'filter-browser-family', name: 'BrowserFamily', rule: 'Chrome' },
  { key: 'filter-browser-language', name: 'BrowserLanguage', rule: 'en' },
  { key: 'filter-device-type', name: 'DeviceType', rule: 'Macintosh' },
  { key: 'filter-os', name: 'OperatingSystem', rule: 'Mac' },
  {
    key: 'filter-context-property',
    name: 'ContextProperty',
    rule: 'Order.Vip = true',
  },
] as const;

export const filterKeys = filterCatalog.map((f) => f.key);

/**
 * HTTP-derived filters need request metadata (country, UA, Accept-Language).
 * Published Astro server buildEvalContext only supplies identity, groups,
 * claims, and entity — so these rows stay honest unsupported for forged
 * query-preset evaluation. Live edge workers can still enforce them.
 */
export const httpDerivedFilterKeys = new Set([
  'filter-country',
  'filter-browser-family',
  'filter-browser-language',
  'filter-device-type',
  'filter-os',
]);

export const orders = {
  vip: { Id: 'ord-vip', Vip: true, Total: 240 },
  standard: { Id: 'ord-standard', Vip: false, Total: 60 },
} as const;

export type PresetName = 'matching' | 'nonmatching';

export const presets: Record<
  PresetName,
  {
    identity: string;
    claims: { role: string };
    order: 'vip' | 'standard';
    country: string;
    language: string;
    userAgent: string;
  }
> = {
  matching: {
    identity: 'alice',
    claims: { role: 'admin' },
    order: 'vip',
    country: 'US',
    language: 'en-US,en;q=0.9',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  nonmatching: {
    identity: 'bob',
    claims: { role: 'user' },
    order: 'standard',
    country: 'CA',
    language: 'fr-FR,fr;q=0.9',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  },
};
