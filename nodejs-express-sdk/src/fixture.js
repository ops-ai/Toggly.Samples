// Offline transport fixture only. Published core performs every evaluation.
import { createServer } from 'node:http';
// These are definition documents in the transport shape consumed by the published
// core. They are not precomputed answers: identity/claims/request/entity still drive
// the real evaluator, exactly as the HTTP tests demonstrate.
const rule = (featureKey, name, parameters = {}) => ({ featureKey, filters: [{ name, parameters }] });
// ContextProperty reads Vip from a supplied Order. Value is serialized text in the
// rule, while ValueType tells the evaluator to compare it as a boolean.
const entity = key => ({ ...rule(key, 'ContextProperty', { Property: 'Vip', Operator: 'eq', Value: 'true', ValueType: 'boolean' }), contextKind: 'Order' });
// AlwaysOn/AlwaysOff give a predictable first toggle exercise. Production rules
// belong in Toggly; changing this array only changes the local fixture on restart.
export const definitions = [
  ...['new-dashboard', 'enhanced-submit', 'beta-access', 'filter-always-on'].map(key => rule(key, 'AlwaysOn')),
  rule('api-v2', 'AlwaysOff'), entity('ExpressCheckout'), entity('filter-context-property'),
  // 50 means a deterministic rollout bucket per feature and identity, not a coin
  // flip per request or a promise that alice/bob land on opposite sides.
  rule('filter-percentage', 'Percentage', { Value: 50 }),
  rule('filter-targeting', 'Targeting', { 'Audience.Users:0': 'alice' }),
  // Claims/HTTP segment filters also have a rollout percentage. Set it to 100
  // to isolate matching in this exercise; omitting it is not an implicit 100%.
  rule('filter-user-claims', 'UserClaims', { Claim: 'role', Value: 'admin', Percentage: 100 }),
  rule('filter-time-window', 'TimeWindow', { Start: '2020-01-01T00:00:00Z', End: '2099-12-31T23:59:59Z' }),
  ...[['country', 'Country', 'US'], ['browser-family', 'BrowserFamily', 'Chrome'], ['browser-language', 'BrowserLanguage', 'en'], ['device-type', 'DeviceType', 'Macintosh'], ['os', 'OperatingSystem', 'Mac']].map(([key, name, value]) => rule(`filter-${key}`, name, { [`${name}:0`]: value, Percentage: 100 })),
];
// Bind an ephemeral loopback port so tests need no account or fixed external host.
// Tests can change status/definitions to exercise real refresh/failure behavior.
// No signature is produced here, so offline success cannot verify signed live transport.
export async function startFixture() {
  const state = { status: 200, definitions, requests: 0 };
  const server = createServer((req, res) => {
    state.requests++;
    res.writeHead(state.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ defs: state.definitions }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { state, baseUrl: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
