import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  createTogglyOptions,
  createTogglyRequestContext,
  togglyIdentityFields,
} from '../src/toggly-config.ts';
import { createTogglyServerClient } from '@ops-ai/astro-feature-flags-toggly';

/**
 * index.astro evaluates targeting via apiClient (evaluated-variants + identity)
 * and ContextProperty via entityClient (definitions-signed + local eval).
 */

const definitions = [
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
];

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes('/evaluated-variants-signed/')) {
    assert.match(url, /[?&](u|userId)=alice\b/, 'variants fetch must include alice');
    return new Response(
      JSON.stringify({
        defs: { 'filter-targeting': { enabled: true } },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  if (url.includes('/definitions-signed/')) {
    return new Response(JSON.stringify(definitions), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return originalFetch(input);
};

const requestContext = createTogglyRequestContext(
  new URL('http://127.0.0.1:4321/?preset=matching'),
  {
    cookies: {
      get(name) {
        if (name === 'sample-preset') return { value: 'matching' };
        return undefined;
      },
    },
  },
);
assert.equal(requestContext.identity, 'alice');

const baseOptions = {
  ...createTogglyOptions(randomUUID(), 'Production', true),
  ...togglyIdentityFields(requestContext),
  verifySignatures: false,
  enableUsageTracking: false,
  telemetryAttachProcessHandlers: false,
  usageFlushInterval: 0,
};

const apiClient = createTogglyServerClient({ ...baseOptions, enableVariants: true });
const entityClient = createTogglyServerClient({ ...baseOptions, enableVariants: false });
const order = {
  kind: 'Order',
  key: 'ord-vip',
  attributes: { Vip: true, Total: 240 },
};

try {
  assert.equal(await apiClient.getFlag('filter-targeting'), true);
  assert.equal(await entityClient.getFlag('filter-context-property', false, order), true);
} finally {
  await apiClient.close({ timeoutMs: 2000 });
  await entityClient.close({ timeoutMs: 2000 });
  globalThis.fetch = originalFetch;
}

console.log('Astro filter matrix SSR evaluation split tests passed.');
