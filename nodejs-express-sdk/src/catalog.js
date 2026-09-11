// A feature key is an exact, case-sensitive contract with the selected environment's
// definitions. Listing it here does not create a Toggly flag or enable it by default.
// ExpressCheckout intentionally retains the shared template's capitalization.
export const baseline = ['new-dashboard', 'api-v2', 'enhanced-submit', 'ExpressCheckout', 'beta-access'];
export const filters = ['always-on', 'percentage', 'targeting', 'user-claims', 'time-window', 'country', 'browser-family', 'browser-language', 'device-type', 'os', 'context-property'].map(name => `filter-${name}`);
export const keys = [...baseline, ...filters];
// Presets supply reproducible inputs, not expected answers. With the template,
// eight filter rows change between these contexts; AlwaysOn and TimeWindow stay
// on. Percentage buckets a stable identity, so either preset may be on or off.
// DeviceType matches the evaluator's parsed device-family text (Macintosh here).
export const presets = {
  matching: { identity: 'alice', role: 'admin', country: 'US', language: 'en-US,en;q=0.9', agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', order: 'ord-vip' },
  'non-matching': { identity: 'bob', role: 'user', country: 'CA', language: 'fr-FR,fr;q=0.9', agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0', order: 'ord-standard' },
};
// Entity context answers "which Order?", separately from "which user?". kind must
// match contextKind on the definition; key identifies the entity; attributes supply
// filter properties. Vip is a boolean, Total a number: preserve their types.
export const orders = {
  'ord-vip': { kind: 'Order', key: 'ord-vip', attributes: { Id: 'ord-vip', Vip: true, Total: 199 } },
  'ord-standard': { kind: 'Order', key: 'ord-standard', attributes: { Id: 'ord-standard', Vip: false, Total: 49 } },
};
// Query identity/role/order override preset values, then demo headers, then defaults.
// No identity cookie/session is stored by this sample: links/forms carry the inputs.
// The default anonymous identity is shared by anonymous requests, not unique per user.
// Preset HTTP fields win over real headers; custom mode lets the adapter parse headers.
export function inputs(req) {
  const p = presets[req.query.preset];
  const value = (key, fallback) => typeof req.query[key] === 'string' ? req.query[key].slice(0, 500) : fallback;
  return { identity: value('identity', p?.identity ?? req.get('x-toggly-identity') ?? 'anonymous'), role: value('role', p?.role ?? req.get('x-demo-role') ?? 'user'), order: orders[value('order', p?.order ?? req.get('x-demo-order'))] ?? orders['ord-standard'], preset: p };
}
