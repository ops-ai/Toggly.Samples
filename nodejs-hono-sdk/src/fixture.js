// Offline transport fixture only. Published core performs every evaluation.
import { createServer } from 'node:http';
// Only the definition transport is local: rules below are data passed to the
// installed core evaluator. This fixture does not prove live provisioning or
// signature verification and must never be labelled as a live Toggly response.
const rule = (featureKey, name, parameters = {}) => ({ featureKey, filters: [{ name, parameters }] });
const entity = key => ({ ...rule(key, 'ContextProperty', { Property: 'Vip', Operator: 'eq', Value: 'true', ValueType: 'boolean' }), contextKind: 'Order' });
// AlwaysOff makes api-v2's denied/negated paths observable. Segment and claim
// rules use 100% so membership controls the result; only Percentage uses 50%.
// ContextProperty also needs contextKind: Order to select the separate entity.
export const definitions = [
  ...['new-dashboard', 'enhanced-submit', 'beta-access', 'filter-always-on'].map(key => rule(key, 'AlwaysOn')),
  rule('api-v2', 'AlwaysOff'), entity('ExpressCheckout'), entity('filter-context-property'),
  rule('filter-percentage', 'Percentage', { Value: 50 }),
  rule('filter-targeting', 'Targeting', { 'Audience.Users:0': 'alice' }),
  rule('filter-user-claims', 'UserClaims', { Claim: 'role', Value: 'admin', Percentage: 100 }),
  rule('filter-time-window', 'TimeWindow', { Start: '2020-01-01T00:00:00Z', End: '2099-12-31T23:59:59Z' }),
  ...[['country', 'Country', 'US'], ['browser-family', 'BrowserFamily', 'Chrome'], ['browser-language', 'BrowserLanguage', 'en'], ['device-type', 'DeviceType', 'Macintosh'], ['os', 'OperatingSystem', 'Mac']].map(([key, name, value]) => rule(`filter-${key}`, name, { [`${name}:0`]: value, Percentage: 100 })),
];
export async function startFixture() {
  // Tests change status/definitions then call the real SDK refresh(): a failed
  // first fetch has no definitions, while a later failure retains cached rules.
  // This is in-process last-known-good state, not a disk cache across restarts.
  const state = { status: 200, definitions, requests: 0 };
  const server = createServer((req, res) => {
    state.requests++;
    res.writeHead(state.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ defs: state.definitions }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { state, baseUrl: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
