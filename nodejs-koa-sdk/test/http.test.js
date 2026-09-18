import { createServer } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { startFixture } from '../src/fixture.js';
import { presets, filters } from '../src/catalog.js';
import { closeKoaToggly, getKoaToggly } from '@ops-ai/toggly-koa';

function isolateFetchFromProduction(originalFetch, onDefinitions) {
  return (url, options) => {
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

// Each test gets a real HTTP server. That exercises Koa's middleware order,
// request headers and adapter integration instead of testing mock functions.
async function serve(config, run) {
  closeKoaToggly();
  const server = createServer(createApp({ ...config, telemetry: false }).callback());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const request = (path, options) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
  try { await run(request); }
  finally { closeKoaToggly(); await new Promise(resolve => server.close(resolve)); }
}

test('actual published Koa adapter and node core HTTP integration', async t => {
  const fixture = await startFixture();
  try {
    await serve({ fixtureUrl: fixture.baseUrl }, async request => {
      await t.test('every contract section renders evaluated HTML', async () => {
        for (const section of ['home', 'declarative', 'programmatic', 'identity', 'entity', 'filters', 'unique', 'configuration']) {
          const html = await (await request(`/${section}?preset=matching`)).text();
          assert.match(html, /Offline fixture/);
          assert.match(html, /aria-label="Sample sections"/);
          assert.match(html, new RegExp(`<h2>${section}</h2>`));
        }
        assert.match(await (await request('/declarative')).text(), /Dashboard v2 variant/);
        assert.match(await (await request('/entity?preset=matching')).text(), /Express checkout available/);
        assert.match(await (await request('/entity?preset=non-matching')).text(), /Standard checkout/);
      });
      await t.test('visible controls retain the active preset, role and Order', async () => {
        for (const [query, preset, role, order] of [['preset=matching', 'matching', 'admin', 'ord-vip'], ['preset=non-matching', 'non-matching', 'user', 'ord-standard'], ['identity=carol&role=auditor&order=ord-vip', '', 'auditor', 'ord-vip']]) {
          const html = await (await request(`/filters?${query}`)).text();
          for (const [name, value] of [['preset', preset], ['role', role], ['order', order]]) {
            const select = html.match(new RegExp(`<select name="${name}">(.+?)</select>`))[1];
            assert.ok(select.includes(`<option value="${value}" selected>`), `${name} selection`);
            assert.equal((select.match(/ selected/g) ?? []).length, 1);
          }
        }
      });
      await t.test('all eleven filter rows isolate request identity, claims, Order and headers', async () => {
        await Promise.all(Array.from({ length: 30 }, async (_, index) => {
          const matching = index % 2 === 0;
          const p = presets[matching ? 'matching' : 'non-matching'];
          const data = await (await request('/api/evaluate', { headers: { 'x-toggly-identity': p.identity, 'x-demo-role': p.role, 'x-demo-order': p.order, 'cf-ipcountry': p.country, 'accept-language': p.language, 'user-agent': p.agent } })).json();
          assert.equal(data.context.identity, p.identity);
          assert.equal(data.context.claims.role, p.role);
          assert.equal(data.context.request.country, p.country);
          assert.equal(data.order.key, p.order);
          for (const key of filters) if (!['filter-percentage', 'filter-always-on', 'filter-time-window'].includes(key)) assert.equal(data.flags[key], matching, key);
          assert.equal(data.flags['filter-always-on'], true);
          assert.equal(data.flags['filter-time-window'], true);
          assert.equal(data.flags.ExpressCheckout, matching);
        }));
        const beforeIdentity = getKoaToggly().identity;
        const first = await (await request('/api/evaluate?preset=matching')).json();
        const second = await (await request('/api/evaluate?preset=matching')).json();
        assert.equal(first.flags['filter-percentage'], second.flags['filter-percentage']);
        assert.equal(getKoaToggly().identity, beforeIdentity);
      });
      await t.test('native gates, route gate, wrapper and one-call override use Koa context', async () => {
        for (const [path, status] of [['/gates/enabled', 200], ['/gates/negate', 200], ['/gates/all', 404], ['/gates/any', 200], ['/unique/route', 403], ['/unique/wrapped', 200]]) assert.equal((await request(path)).status, status, path);
        const snapshot = await (await request('/api/features?identity=bob')).json();
        assert.equal(snapshot.identity, 'bob');
        const override = await (await request('/api/override?identity=bob')).json();
        assert.equal(override.ambientBefore, false);
        assert.equal(override.override, true);
        assert.equal(override.ambientAfter, false);
      });
      await t.test('definition changes affect rendered variants and adapter gates', async () => {
        const original = fixture.state.definitions;
        fixture.state.definitions = original.map(def => ['new-dashboard', 'enhanced-submit', 'beta-access'].includes(def.featureKey) ? { ...def, filters: [{ name: 'AlwaysOff' }] } : def.featureKey === 'api-v2' ? { ...def, filters: [{ name: 'AlwaysOn' }] } : def);
        await getKoaToggly().refresh();
        assert.match(await (await request('/declarative')).text(), /Classic dashboard variant/);
        assert.equal((await request('/gates/enabled')).status, 404);
        assert.equal((await request('/gates/negate')).status, 404);
        assert.equal((await request('/unique/route')).status, 200);
        assert.equal((await request('/unique/wrapped')).status, 404);
        assert.equal((await request('/gates/beta', { redirect: 'manual' })).status, 302);
        fixture.state.definitions = original;
        await getKoaToggly().refresh();
      });
      await t.test('failed refresh retains last known definitions with cached provenance', async () => {
        fixture.state.status = 503;
        await getKoaToggly().refresh();
        const data = await (await request('/api/evaluate')).json();
        assert.match(data.source, /^Offline fixture — Cached/);
        assert.equal(data.flags['new-dashboard'], true);
        assert.match((await request('/api/features')).headers.get('x-toggly-source'), /^Offline fixture - Cached/);
      });
    });
    await t.test('failed first fetch stays unavailable and gates deny', async () => {
      await serve({ fixtureUrl: fixture.baseUrl }, async request => {
        const data = await (await request('/api/evaluate')).json();
        assert.match(data.source, /^Offline fixture — Unavailable/);
        assert.equal(data.flags['new-dashboard'], false);
        assert.equal((await request('/gates/enabled')).status, 404);
        assert.equal((await request('/gates/beta', { redirect: 'manual' })).status, 302);
      });
    });
    await t.test('configured signed mode rejects unsigned transport', async () => {
      const originalFetch = globalThis.fetch;
      let definitionRequests = 0;
      globalThis.fetch = isolateFetchFromProduction(originalFetch, () => {
        definitionRequests++;
        return Promise.resolve(new Response(JSON.stringify({ defs: fixture.state.definitions }), { status: 200 }));
      });
      try {
        await serve({ appKey: 'test-only-not-a-real-key' }, async request => {
          const data = await (await request('/api/evaluate')).json();
          assert.match(data.source, /^Unavailable/);
          assert.equal(data.flags['new-dashboard'], false);
          assert.ok(getKoaToggly().state.error);
        });
        assert.ok(definitionRequests > 0);
      } finally { globalThis.fetch = originalFetch; }
    });
    for (const appKey of ['', 'ci-placeholder']) await t.test(`missing/placeholder configuration ${appKey || 'empty'}`, async () => {
      const before = fixture.state.requests;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (url, options) => { assert.match(String(url), /^http:\/\/127\.0\.0\.1:/, 'missing key must never contact an external service'); return originalFetch(url, options); };
      try {
        await serve({ appKey }, async request => {
          assert.match(await (await request('/')).text(), /Missing app key/);
          assert.equal((await request('/gates/enabled')).status, 404);
        });
      } finally { globalThis.fetch = originalFetch; }
      assert.equal(fixture.state.requests, before);
    });
  } finally { await fixture.close(); }
});
