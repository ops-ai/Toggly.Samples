/**
 * Real-package background refresh regression.
 *
 * Mirrors Vue workshop: public SDK refresh updates the sample live snapshot
 * without a duplicate sample-owned fetch, then unsubscribe stops further
 * listener calls.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  $flags,
  __resetClient,
  initTogglyClient,
  refreshFlags,
  stopRefreshInterval,
  stopWebSocket,
} from '@ops-ai/astro-feature-flags-toggly/client/store';
import {
  readLiveSnapshot,
  subscribeLiveSnapshot,
} from '../src/sample/live-flags.ts';

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
let payload = {
  'new-dashboard': true,
  'filter-always-on': true,
  'api-v2': false,
};

globalThis.fetch = async () => {
  fetchCalls += 1;
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

try {
  __resetClient();
  await initTogglyClient({
    appKey: randomUUID(),
    baseURI: 'https://definitions.example.invalid',
    environment: 'Production',
    verifySignatures: false,
    // Deterministic offline regression: exercise refresh without sockets.
    enableLiveUpdates: false,
    enableVariants: false,
    featureFlagsRefreshInterval: 0,
    flagDefaults: {
      'new-dashboard': false,
      'filter-always-on': false,
      'api-v2': false,
    },
  });

  assert.equal(fetchCalls, 1, 'init should fetch once through the real client');
  assert.equal($flags.get()['new-dashboard'], true);

  const snapshots = [];
  const unsub = subscribeLiveSnapshot($flags, (snapshot) => {
    snapshots.push(snapshot);
  });

  assert.equal(snapshots.length, 1, 'subscribe delivers the current store value');
  assert.equal(snapshots[0]['new-dashboard'], true);
  assert.equal(snapshots[0]['filter-always-on'], true);

  const fetchesBeforeRefresh = fetchCalls;
  payload = {
    'new-dashboard': false,
    'filter-always-on': false,
    'api-v2': true,
  };

  // Public SDK call — same path WebSocket live reload uses to update `$flags`.
  await refreshFlags();

  assert.equal(
    fetchCalls,
    fetchesBeforeRefresh + 1,
    'refreshFlags owns the network; sample listener must not fetch',
  );
  assert.equal(snapshots.length, 2, 'listener re-reads store after refresh');
  assert.equal(snapshots[1]['new-dashboard'], false);
  assert.equal(snapshots[1]['filter-always-on'], false);
  assert.equal(snapshots[1]['api-v2'], true);
  assert.deepEqual(snapshots[1], readLiveSnapshot($flags.get()));

  unsub();
  const afterUnsub = snapshots.length;
  payload = {
    'new-dashboard': true,
    'filter-always-on': true,
    'api-v2': false,
  };
  await refreshFlags();

  assert.equal(
    snapshots.length,
    afterUnsub,
    'unsubscribe must stop sample live-snapshot listeners',
  );
  assert.equal(
    $flags.get()['new-dashboard'],
    true,
    'store still updates after sample cleanup',
  );
} finally {
  stopWebSocket();
  stopRefreshInterval();
  __resetClient();
  globalThis.fetch = originalFetch;
}

console.log(
  'Astro live-refresh regression passed ($flags subscribe, refreshFlags, unsubscribe).',
);
