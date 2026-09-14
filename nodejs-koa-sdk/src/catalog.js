// A feature key is an exact, case-sensitive contract with the selected environment.
// Listing a key here makes it visible in the sample; it does not create or enable it.
export const baseline = ['new-dashboard', 'api-v2', 'enhanced-submit', 'ExpressCheckout', 'beta-access'];
export const filters = ['always-on', 'percentage', 'targeting', 'user-claims', 'time-window', 'country', 'browser-family', 'browser-language', 'device-type', 'os', 'context-property'].map(name => `filter-${name}`);
export const keys = [...baseline, ...filters];

// These inputs make each targeting exercise repeatable. They are not expected
// answers: the published evaluator still reads the actual definition rules.
export const presets = {
  matching: { identity: 'alice', role: 'admin', country: 'US', language: 'en-US,en;q=0.9', agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', order: 'ord-vip' },
  'non-matching': { identity: 'bob', role: 'user', country: 'CA', language: 'fr-FR,fr;q=0.9', agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0', order: 'ord-standard' },
};

// Entity context answers "which Order?" separately from "which user?". The
// kind must match the Toggly context kind. Keep boolean/number values typed.
export const orders = {
  'ord-vip': { kind: 'Order', key: 'ord-vip', attributes: { Id: 'ord-vip', Vip: true, Total: 199 } },
  'ord-standard': { kind: 'Order', key: 'ord-standard', attributes: { Id: 'ord-standard', Vip: false, Total: 49 } },
};

// Query fields intentionally model a demo only. A production Koa application
// must obtain identity and claims from its trusted session, never from a query.
// With no preset, Koa's adapter reads segment headers through fromHttpRequest.
export function inputs(ctx) {
  const p = presets[ctx.query.preset];
  const value = (key, fallback) => typeof ctx.query[key] === 'string' ? ctx.query[key].slice(0, 500) : fallback;
  return {
    identity: value('identity', p?.identity ?? ctx.get('x-toggly-identity') ?? 'anonymous'),
    role: value('role', p?.role ?? ctx.get('x-demo-role') ?? 'user'),
    order: orders[value('order', p?.order ?? ctx.get('x-demo-order'))] ?? orders['ord-standard'],
    preset: p,
  };
}
