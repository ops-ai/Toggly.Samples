import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTogglyServerClient } from '@ops-ai/astro-feature-flags-toggly';

/**
 * Offline behavioral tests against the real published server client.
 * Fake transport returns signed-definition shaped payloads; signatures off.
 */

const originalFetch = globalThis.fetch;
const requests = [];

const definitions = [
  {
    featureKey: 'filter-user-claims',
    filters: [
      {
        name: 'UserClaims',
        parameters: { Percentage: 100, Claim: 'role', Value: 'admin' },
      },
    ],
  },
  {
    featureKey: 'filter-targeting',
    filters: [
      {
        name: 'Targeting',
        // Indexed Audience.Users list — not a scalar Users field or 100% default rollout.
        parameters: { 'Audience.Users:0': 'alice' },
      },
    ],
  },
  {
    featureKey: 'filter-always-on',
    filters: [{ name: 'AlwaysOn', parameters: {} }],
  },
  {
    featureKey: 'filter-time-window',
    filters: [
      {
        name: 'TimeWindow',
        parameters: {
          StartDate: '2020-01-01T00:00:00Z',
          EndDate: '2099-12-31T23:59:59Z',
        },
      },
    ],
  },
  {
    featureKey: 'filter-context-property',
    filters: [
      {
        name: 'ContextProperty',
        parameters: {
          Property: 'Vip',
          Operator: 'eq',
          Value: 'true',
          ValueType: 'boolean',
        },
      },
    ],
  },
  {
    featureKey: 'ExpressCheckout',
    filters: [
      {
        name: 'ContextProperty',
        parameters: {
          Property: 'Vip',
          Operator: 'eq',
          Value: 'true',
          ValueType: 'boolean',
        },
      },
    ],
  },
  {
    featureKey: 'new-dashboard',
    filters: [{ name: 'AlwaysOn', parameters: {} }],
  },
  {
    featureKey: 'api-v2',
    filters: [],
  },
];

globalThis.fetch = async (input) => {
  const url = String(input);
  requests.push(url);
  const payload = url.includes('/evaluated-variants-signed/')
    ? {
        defs: {
          'new-dashboard': {
            enabled: true,
            variant: 'preview',
            configurationValue: { density: 'compact' },
          },
        },
      }
    : definitions;
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

function client(context = {}, variants = false) {
  return createTogglyServerClient({
    // Opaque route token — exercises URL construction without a real credential.
    appKey: randomUUID(),
    baseURI: 'https://definitions.example.invalid',
    environment: 'Production',
    verifySignatures: false,
    enableVariants: variants,
    enableUsageTracking: false,
    telemetryAttachProcessHandlers: false,
    usageFlushInterval: 0,
    ...context,
  });
}

try {
  const variants = client({}, true);
  assert.deepEqual(await variants.getVariant('new-dashboard'), {
    name: 'preview',
    configurationValue: { density: 'compact' },
  });
  await variants.close();

  const matching = client({ identity: 'alice', claims: { role: 'admin' } });
  assert.equal(await matching.getFlag('filter-user-claims'), true);
  assert.equal(await matching.getFlag('filter-targeting'), true);
  assert.equal(await matching.getFlag('filter-always-on'), true);
  assert.equal(await matching.getFlag('filter-time-window'), true);
  assert.equal(await matching.getFlag('new-dashboard'), true);
  assert.equal(await matching.getFlag('api-v2'), false);
  assert.equal(
    await matching.evaluateGate(['new-dashboard', 'api-v2'], 'any'),
    true,
  );
  assert.equal(
    await matching.evaluateGate(['new-dashboard', 'api-v2'], 'all'),
    false,
  );
  await matching.close();

  const nonMatching = client({ identity: 'bob', claims: { role: 'user' } });
  assert.equal(await nonMatching.getFlag('filter-user-claims'), false);
  assert.equal(await nonMatching.getFlag('filter-targeting'), false);
  await nonMatching.close();

  const orders = client();
  assert.equal(
    await orders.getFlag('filter-context-property', false, {
      kind: 'Order',
      key: 'ord-vip',
      attributes: { Vip: true },
    }),
    true,
  );
  assert.equal(
    await orders.getFlag('filter-context-property', false, {
      kind: 'Order',
      key: 'ord-standard',
      attributes: { Vip: false },
    }),
    false,
  );
  assert.equal(
    await orders.getFlag('ExpressCheckout', false, {
      kind: 'Order',
      key: 'ord-vip',
      attributes: { Vip: true },
    }),
    true,
  );
  assert.equal(
    await orders.getFlag('ExpressCheckout', false, {
      kind: 'Order',
      key: 'ord-standard',
      attributes: { Vip: false },
    }),
    false,
  );
  await orders.close();

  // Missing-key / defaults path: empty appKey uses flagDefaults, no network.
  const defaultsOnly = createTogglyServerClient({
    appKey: '',
    environment: 'Production',
    flagDefaults: { 'new-dashboard': true, 'api-v2': false },
    enableUsageTracking: false,
    telemetryAttachProcessHandlers: false,
    usageFlushInterval: 0,
  });
  const before = requests.length;
  assert.equal(await defaultsOnly.getFlag('new-dashboard'), true);
  assert.equal(await defaultsOnly.getFlag('api-v2'), false);
  assert.equal(requests.length, before);
  await defaultsOnly.close();

  assert.ok(requests.some((url) => url.includes('/evaluated-variants-signed/')));
  assert.ok(requests.some((url) => url.includes('/definitions-signed/')));
} finally {
  globalThis.fetch = originalFetch;
}

console.log(
  'Astro SDK evaluation tests passed (variants, claims, targeting, Order, defaults).',
);
