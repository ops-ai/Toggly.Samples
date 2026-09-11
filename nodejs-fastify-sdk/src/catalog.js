// These exact strings join application checks to dashboard/fixture definitions.
// Keeping them together helps spot spelling/case mismatches: an unknown key is OFF.
export const baseline = ['new-dashboard', 'api-v2', 'enhanced-submit', 'ExpressCheckout', 'beta-access'];
export const filters = ['always-on', 'percentage', 'targeting', 'user-claims', 'time-window', 'country', 'browser-family', 'browser-language', 'device-type', 'os', 'context-property'].map(name => `filter-${name}`);
export const keys = [...baseline, ...filters];
// Presets change targeting inputs, not flag rules. Most fixture filters distinguish
// these users, but AlwaysOn/open TimeWindow remain ON. Percentage hashes identity
// with the flag key, so a 50% rollout does not promise one ON and one OFF here.
export const presets = {
  matching: { identity: 'alice', role: 'admin', country: 'US', language: 'en-US,en;q=0.9', agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', order: 'ord-vip' },
  'non-matching': { identity: 'bob', role: 'user', country: 'CA', language: 'fr-FR,fr;q=0.9', agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0', order: 'ord-standard' },
};
// Ready entity contexts map our demo orders to the core's {kind,key,attributes}
// contract. The definition's contextKind must be Order; its Property is Vip (not
// "Order.Vip" in the wire parameters). This avoids registering an object mapper.
// Entity attributes describe the purchase, separately from the user's role/identity.
export const orders = {
  'ord-vip': { kind: 'Order', key: 'ord-vip', attributes: { Id: 'ord-vip', Vip: true, Total: 199 } },
  'ord-standard': { kind: 'Order', key: 'ord-standard', attributes: { Id: 'ord-standard', Vip: false, Total: 49 } },
};
// Query controls override preset values, then headers/defaults supply missing values.
// Unknown orders become ord-standard. The size limit is demo input handling, not
// identity verification. The fallback "anonymous" shares one percentage bucket.
export function inputs(req) {
  const p = presets[req.query.preset];
  const value = (key, fallback) => typeof req.query[key] === 'string' ? req.query[key].slice(0, 500) : fallback;
  return { identity: value('identity', p?.identity ?? req.headers['x-toggly-identity'] ?? 'anonymous'), role: value('role', p?.role ?? req.headers['x-demo-role'] ?? 'user'), order: orders[value('order', p?.order ?? req.headers['x-demo-order'])] ?? orders['ord-standard'], preset: p };
}
