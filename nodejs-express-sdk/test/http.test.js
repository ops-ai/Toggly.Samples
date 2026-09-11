import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { startFixture } from '../src/fixture.js';
import { presets, filters } from '../src/catalog.js';
import { closeExpressToggly, getExpressToggly } from '@ops-ai/toggly-express';
async function serve(config, run) {
  closeExpressToggly();
  const server = createApp(config).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const request = (path, options) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
  try { await run(request); } finally { closeExpressToggly(); await new Promise(resolve => server.close(resolve)); }
}
test('actual published adapter/core HTTP integration', async t => {
  const fixture = await startFixture();
  try {
    await serve({ fixtureUrl: fixture.baseUrl }, async request => {
      await t.test('all HTML sections and boolean variants render real evaluations', async () => {
        for (const section of ['home', 'declarative', 'programmatic', 'identity', 'entity', 'filters', 'unique', 'configuration']) {
          const html = await (await request(`/${section}?preset=matching`)).text();
          assert.match(html, /Offline fixture/); assert.match(html, /aria-label="Sample sections"/);
          assert.match(html, new RegExp(`<h2>${section}</h2>`));
        }
        assert.match(await (await request('/declarative')).text(), /Dashboard v2 variant/);
        assert.match(await (await request('/entity?preset=matching')).text(), /Express checkout available/);
        assert.match(await (await request('/entity?preset=non-matching')).text(), /Standard checkout/);
      });
      await t.test('visible controls reflect active preset, role and Order', async () => {
        for (const [query, preset, role, order] of [
          ['preset=matching', 'matching', 'admin', 'ord-vip'],
          ['preset=non-matching', 'non-matching', 'user', 'ord-standard'],
          ['identity=carol&role=auditor&order=ord-vip', '', 'auditor', 'ord-vip'],
        ]) {
          const html = await (await request(`/filters?${query}`)).text();
          for (const [name, value] of [['preset', preset], ['role', role], ['order', order]]) {
            const select = html.match(new RegExp(`<select name="${name}">(.+?)</select>`))[1];
            assert.ok(select.includes(`<option value="${value}" selected>`), `${name} selection`);
            assert.equal((select.match(/ selected/g) ?? []).length, 1);
          }
        }
      });
      await t.test('adapter-owned response headers retain offline provenance', async () => {
        for (const path of ['/api/features', '/gates/enabled', '/gates/all', '/unique/route', '/unique/wrapped']) {
          const response = await request(path, { redirect: 'manual' });
          assert.match(response.headers.get('x-toggly-source'), /^Offline fixture/);
        }
      });
      await t.test('all filter rows and 30 simultaneous request identities, claims, Order and HTTP headers', async () => {
        const globalIdentity = getExpressToggly().identity;
        await Promise.all(Array.from({ length: 30 }, async (_, index) => {
          const matching = index % 2 === 0; const p = presets[matching ? 'matching' : 'non-matching'];
          const data = await (await request('/api/evaluate', { headers: { 'x-toggly-identity': p.identity, 'x-demo-role': p.role, 'x-demo-order': p.order, 'cf-ipcountry': p.country, 'accept-language': p.language, 'user-agent': p.agent } })).json();
          assert.equal(data.context.identity, p.identity); assert.equal(data.context.claims.role, p.role); assert.equal(data.context.request.country, p.country); assert.equal(data.order.key, p.order);
          for (const key of filters) if (!['filter-percentage', 'filter-always-on', 'filter-time-window'].includes(key)) assert.equal(data.flags[key], matching, key);
          assert.equal(data.flags['filter-always-on'], true); assert.equal(data.flags['filter-time-window'], true); assert.equal(data.flags.ExpressCheckout, matching);
        }));
        const a = await (await request('/api/evaluate?preset=matching')).json();
        const b = await (await request('/api/evaluate?preset=matching')).json();
        assert.equal(a.flags['filter-percentage'], b.flags['filter-percentage']);
        assert.equal(getExpressToggly().identity, globalIdentity);
      });
      await t.test('middleware gates, negate, all/any and unique handlers', async () => {
        for (const [path, status] of [['/gates/enabled', 200], ['/gates/negate', 200], ['/gates/all', 404], ['/gates/any', 200], ['/unique/route', 403], ['/unique/wrapped', 200]]) assert.equal((await request(path)).status, status, path);
        const snapshot = await (await request('/api/features?identity=bob')).json(); assert.equal(snapshot.identity, 'bob');
        const result = await (await request('/api/override?identity=bob')).json(); assert.equal(result.ambientBefore, false); assert.equal(result.override, true); assert.equal(result.ambientAfter, false);
      });
      await t.test('definition changes flip rendered variant and adapter gate outcomes', async () => {
        const original = fixture.state.definitions;
        fixture.state.definitions = original.map(def => ['new-dashboard', 'enhanced-submit', 'beta-access'].includes(def.featureKey) ? { ...def, filters: [{ name: 'AlwaysOff' }] } : def.featureKey === 'api-v2' ? { ...def, filters: [{ name: 'AlwaysOn' }] } : def);
        await getExpressToggly().refresh();
        assert.match(await (await request('/declarative')).text(), /Classic dashboard variant/);
        assert.equal((await request('/gates/enabled')).status, 404);
        assert.equal((await request('/gates/negate')).status, 404);
        assert.equal((await request('/unique/route')).status, 200);
        assert.equal((await request('/unique/wrapped')).status, 404);
        assert.equal((await request('/gates/beta', { redirect: 'manual' })).status, 302);
        fixture.state.definitions = original;
        await getExpressToggly().refresh();
      });
      await t.test('failed refresh preserves last known definitions and reports cached provenance', async () => {
        fixture.state.status = 503; await getExpressToggly().refresh();
        const data = await (await request('/api/evaluate')).json(); assert.match(data.source, /^Offline fixture — Cached/); assert.equal(data.flags['new-dashboard'], true);
        const snapshot = await request('/api/features');
        assert.match(snapshot.headers.get('x-toggly-source'), /^Offline fixture - Cached/);
        assert.match(await (await request('/')).text(), /Offline fixture — Cached/);
      });
    });
    await t.test('first fetch fails: unavailable, not live; gates still deny', async () => {
      await serve({ fixtureUrl: fixture.baseUrl }, async request => {
        const data = await (await request('/api/evaluate')).json(); assert.match(data.source, /^Offline fixture — Unavailable/); assert.equal(data.flags['new-dashboard'], false);
        const gate = await request('/gates/enabled');
        assert.equal(gate.status, 404);
        assert.match(gate.headers.get('x-toggly-source'), /^Offline fixture - Unavailable/);
        const redirect = await request('/gates/beta', { redirect: 'manual' });
        assert.equal(redirect.status, 302);
        assert.match(redirect.headers.get('x-toggly-source'), /^Offline fixture - Unavailable/);
        assert.match(await (await request('/')).text(), /Offline fixture — Unavailable/);
      });
    });
    await t.test('configured signed mode rejects unsigned transport and never claims live', async () => {
      const originalFetch = globalThis.fetch;
      let definitionRequests = 0;
      globalThis.fetch = (url, options) => {
        if (String(url).startsWith('https://definitions.toggly.io/')) {
          definitionRequests++;
          return Promise.resolve(new Response(JSON.stringify({ defs: fixture.state.definitions }), { status: 200 }));
        }
        return originalFetch(url, options);
      };
      try {
        await serve({ appKey: 'test-only-not-a-real-key' }, async request => {
          const data = await (await request('/api/evaluate')).json();
          assert.match(data.source, /^Unavailable/);
          assert.equal(data.flags['new-dashboard'], false);
          assert.ok(getExpressToggly().state.error);
        });
        assert.ok(definitionRequests > 0);
      } finally { globalThis.fetch = originalFetch; }
    });
    for (const appKey of ['', 'ci-placeholder']) await t.test(`missing/placeholder configuration ${appKey}`, async () => {
      const before = fixture.state.requests;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (url, options) => { assert.match(String(url), /^http:\/\/127\.0\.0\.1:/, 'missing key must never contact external service'); return originalFetch(url, options); };
      await serve({ appKey }, async request => { assert.match(await (await request('/')).text(), /Missing app key/); assert.equal((await request('/gates/enabled')).status, 404); });
      globalThis.fetch = originalFetch;
      assert.equal(fixture.state.requests, before);
    });
  } finally { await fixture.close(); }
});
