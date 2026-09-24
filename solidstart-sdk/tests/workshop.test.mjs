import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTogglyClient,
  createTogglyRequest,
  serializeSnapshot,
} from '@ops-ai/solid-feature-flags-toggly/server';
import { createClient } from '@ops-ai/solid-feature-flags-toggly';
import { keys, defaults, order } from '../src/catalog.ts';
test('SDK API defaults, public allowlist and guarded action behavior', async () => {
  const client = createTogglyClient({
    featureDefaults: defaults,
    enableUsageTracking: false,
    enableMetrics: false,
    enableFileCache: false,
  });
  await client.init();
  const scope = createTogglyRequest({
    client,
    request: new Request('http://localhost'),
    context: { identity: 'private-session' },
    clientContext: { identity: 'alice' },
    frontend: { expose: keys, flagDefaults: { ...defaults, secret: true } },
  });
  try {
    assert.equal(await scope.isEnabled('new-dashboard'), true);
    assert.equal(await scope.isEnabled('missing'), false);
    await assert.rejects(scope.requireFeature('enhanced-submit'), (e) => e.status === 404);
    const text = serializeSnapshot(await scope.snapshot());
    assert(!text.includes('private-session'));
    assert(!text.includes('secret'));
    assert.deepEqual(order(true).attributes, { Vip: true });
  } finally {
    scope.dispose();
    await client.close();
  }
});

test('server-side client evaluation and explicit telemetry calls do not send frontend telemetry', async () => {
  let requests = 0;
  const client = createClient({
    appKey: 'sample-test-key',
    identity: 'server-user',
    flagDefaults: defaults,
    enableLiveUpdates: false,
    refreshInterval: 0,
    telemetryFetch: async () => {
      requests++;
      return { status: 202 };
    },
  });
  try {
    assert.equal(client.evaluate(['new-dashboard']), true);
    client.recordUsage('new-dashboard');
    client.recordView('new-dashboard');
    client.incrementCounter('orders');
    client.setGauge('cart-items', 3);
    await client.flushTelemetry();
  } finally {
    client.dispose();
  }
  assert.equal(requests, 0);
});
