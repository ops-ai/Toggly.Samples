import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTogglyClient,
  createTogglyRequest,
  serializeSnapshot,
} from '@ops-ai/solid-feature-flags-toggly/server';
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
