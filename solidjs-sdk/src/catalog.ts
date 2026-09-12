export const keys = [
  'new-dashboard',
  'api-v2',
  'enhanced-submit',
  'ExpressCheckout',
  'beta-access',
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
];
export const defaults = Object.fromEntries(
  keys.map((key) => [key, ['new-dashboard', 'api-v2', 'filter-always-on'].includes(key)]),
);
export const sections = [
  'Home',
  'Declarative gates',
  'Programmatic API',
  'Identity',
  'Entity context',
  'Filters matrix',
  'Solid ownership',
  'Configuration',
];
export const presets = {
  Matching: { identity: 'alice', groups: ['staff'], claims: { role: 'admin' } },
  'Non-matching': { identity: 'bob', groups: [], claims: { role: 'user' } },
};
export const order = (vip: boolean) => ({
  kind: 'Order',
  key: vip ? 'ord-vip' : 'ord-standard',
  attributes: { Vip: vip },
});
