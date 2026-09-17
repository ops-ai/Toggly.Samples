import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { startFixture } from '../src/fixture.js';

function isolateFetchFromProduction(
  originalFetch: typeof fetch,
  onDefinitions: (url: string, options?: RequestInit) => Promise<Response>,
) {
  return (url: RequestInfo | URL, options?: RequestInit) => {
    const href = String(url);
    if (href.startsWith('https://definitions.toggly.io/')) {
      return onDefinitions(href, options);
    }
    if (/^https?:\/\/127\.0\.0\.1(?::\d+)?(?:[/?#]|$)/.test(href)) {
      return originalFetch(url, options);
    }
    if (/^https?:\/\/([a-z0-9-]+\.)*toggly\.io(?::\d+)?(?:[/?#]|$)/i.test(href)) {
      return Promise.resolve(new Response('{}', { status: 204 }));
    }
    assert.fail(`test keys must never contact an external service: ${href}`);
  };
}

test('installed NestJS package drives all eight sections, gates, presets and entity overrides', async () => {
  const fixture = await startFixture();
  const app = await createApp({ fixtureUrl: fixture.baseUrl });
  await app.listen(0, '127.0.0.1');
  const url = await app.getUrl();
  try {
    for (const section of [
      'home',
      'declarative',
      'programmatic',
      'identity',
      'entity',
      'filters',
      'unique',
      'configuration',
    ]) {
      const response = await fetch(`${url}/${section}?preset=matching`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /NestJS SDK Sample/);
      assert.match(html, /Offline fixture/);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    const read = async (path: string) => (await fetch(url + path)).json();
    const [matching, other] = await Promise.all([
      read('/api/evaluate?preset=matching'),
      read('/api/evaluate?preset=non-matching'),
    ]);
    assert.equal(matching.context.identity, 'alice');
    assert.equal(other.context.identity, 'bob');
    assert.equal(matching.flags.ExpressCheckout, true);
    assert.equal(other.flags.ExpressCheckout, false);
    for (const flag of [
      'targeting',
      'user-claims',
      'country',
      'browser-family',
      'browser-language',
      'device-type',
      'os',
      'context-property',
    ]) {
      assert.equal(matching.flags['filter-' + flag], true, flag);
      assert.equal(other.flags['filter-' + flag], false, flag);
    }
    for (const flag of ['filter-always-on', 'filter-time-window']) {
      assert.equal(matching.flags[flag], true);
      assert.equal(other.flags[flag], true);
    }
    assert.equal(
      matching.flags['filter-percentage'],
      (await read('/api/evaluate?preset=matching')).flags['filter-percentage'],
    );
    assert.deepEqual(await read('/api/override?preset=non-matching'), {
      ambientBefore: false,
      override: true,
      ambientAfter: false,
      identity: 'bob',
    });
    assert.equal((await fetch(url + '/gates/enabled')).status, 200);
    assert.equal((await fetch(url + '/gates/negate')).status, 200);
    assert.equal((await fetch(url + '/gates/all')).status, 404);
    assert.equal((await fetch(url + '/gates/any')).status, 200);
    assert.deepEqual(await read('/unique/parameter'), { enhancedSubmit: true });
    assert.equal((await read('/api/health')).initialized, true);
    const escaped = await (await fetch(url + '/identity?identity=%3Cscript%3E')).text();
    assert.ok(!escaped.includes('<script>'));
    assert.match(escaped, /&lt;script&gt;/);
  } finally {
    await app.close();
    await fixture.close();
  }
});
test('missing key uses defaults without crashing and makes the configuration gap visible', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = isolateFetchFromProduction(originalFetch, () => {
    assert.fail('missing key must never contact definitions.toggly.io');
  });
  try {
    const app = await createApp();
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    try {
      assert.match(await (await fetch(url)).text(), /Missing app key/);
      assert.equal((await fetch(url + '/gates/enabled')).status, 404);
      assert.equal((await fetch(url + '/gates/beta')).status, 403);
      assert.deepEqual(await (await fetch(url + '/unique/parameter')).json(), {
        enhancedSubmit: false,
      });
    } finally {
      await app.close();
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('configured signed mode rejects unsigned transport and never contacts production', async () => {
  const originalFetch = globalThis.fetch;
  let definitionRequests = 0;
  globalThis.fetch = isolateFetchFromProduction(originalFetch, () => {
    definitionRequests++;
    return Promise.resolve(new Response(JSON.stringify({ defs: [] }), { status: 200 }));
  });
  try {
    const app = await createApp({ appKey: 'test-only-not-a-real-key', telemetry: false });
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    try {
      const data = await (await fetch(url + '/api/evaluate')).json();
      assert.match(data.source, /^Unavailable/);
      assert.equal(data.flags['new-dashboard'], false);
    } finally {
      await app.close();
    }
    assert.ok(definitionRequests > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
