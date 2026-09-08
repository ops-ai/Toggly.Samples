import { Hono } from 'hono';
import { togglyMiddleware, featureGate, featureRoutes, withFeature, featuresHandler } from '@ops-ai/toggly-hono';
import { inputs, keys, filters } from './catalog.js';
import { page } from './view.js';

// The published adapter has one module-level client: run one configured app per process.
export function createApp({ appKey = '', environment = 'Production', fixtureUrl, hooks = [], contextHook } = {}) {
  const app = new Hono();
  const offline = Boolean(fixtureUrl);
  const configured = Boolean(appKey && appKey !== 'ci-placeholder');
  app.use('*', async (c, next) => {
    c.set('provenance', offline ? 'Offline fixture — initialization unavailable' : configured ? 'Configured service — initialization unavailable' : 'Missing app key — defaults only; no network');
    c.header('X-Toggly-Source', c.get('provenance').replaceAll('—', '-'));
    c.header('Cache-Control', 'no-store');
    await next();
  });
  app.use('*', togglyMiddleware({
    appKey: offline ? 'offline-fixture' : configured ? appKey : undefined,
    environment, baseUrl: fixtureUrl, verifySignatures: !offline,
    enableStreaming: false, refreshInterval: offline || !configured ? 0 : 180000,
    timeout: 3000, registerContextsOnStartup: false, hooks,
    async getContext(c) {
      const input = inputs(c.req);
      // Async hook models authentication lookup without changing global identity.
      await contextHook?.(c);
      return { identity: input.identity, claims: { role: input.role },
        ...(input.preset ? { request: { country: input.preset.country, acceptLanguage: input.preset.language, userAgent: input.preset.agent } } : {}) };
    },
  }));
  app.use('*', async (c, next) => {
    const state = c.get('toggly').client.state;
    const failure = `${state.definitions.size ? 'Cached' : 'Unavailable'} — definition refresh failed`;
    c.set('provenance', offline ? `Offline fixture — ${state.error ? failure : 'published SDK evaluation, no live Toggly service'}` : !configured ? 'Missing app key — defaults only; no network' : state.error ? failure : 'Live definitions — signature verified');
    c.header('X-Toggly-Source', c.get('provenance').replaceAll('—', '-'));
    await next();
  });
  const evaluate = async c => {
    const toggly = c.get('toggly');
    return Object.fromEntries(await Promise.all(keys.map(async key => [key, await toggly.client.isFeatureOn(key, toggly.context, inputs(c.req).order)])));
  };
  app.get('/api/evaluate', async c => c.json({ source: c.get('provenance'), context: c.get('toggly').context, order: inputs(c.req).order, flags: await evaluate(c) }));
  app.get('/api/override', async c => {
    const toggly = c.get('toggly');
    return c.json({ source: c.get('provenance'), ambientBefore: await toggly.isFeatureOn('filter-targeting'), override: await toggly.client.isFeatureOn('filter-targeting', { ...toggly.context, identity: 'alice' }), ambientAfter: await toggly.isFeatureOn('filter-targeting'), identity: toggly.identity });
  });
  app.get('/api/features', featuresHandler);
  const result = label => c => c.json({ result: label, source: c.get('provenance') });
  app.get('/gates/enabled', featureGate({ featureKey: 'new-dashboard' }), result('dashboard v2'));
  app.get('/gates/negate', featureGate({ featureKey: 'api-v2', negate: true }), result('legacy API'));
  for (const requirement of ['all', 'any']) app.get(`/gates/${requirement}`, featureGate({ featureKey: ['new-dashboard', 'api-v2'], requirement }), result(requirement));
  app.get('/gates/beta', featureGate({ featureKey: 'beta-access', redirectTo: '/declarative' }), result('beta'));
  app.use('*', featureRoutes([{ path: /^\/unique\/route$/, methods: ['GET'], featureKey: 'api-v2', onDisabled: c => c.json({ error: 'API v2 disabled', source: c.get('provenance') }, 403) }]));
  app.get('/unique/route', result('featureRoutes'));
  app.post('/unique/route', result('POST outside GET route policy'));
  app.get('/unique/wrapped', withFeature('enhanced-submit', result('withFeature')));
  const sections = ['home', 'declarative', 'programmatic', 'identity', 'entity', 'filters', 'unique', 'configuration'];
  for (const path of ['/', ...sections.map(section => `/${section}`)]) app.get(path, async c => c.html(page({ section: c.req.path.slice(1) || 'home', source: c.get('provenance'), context: c.get('toggly').context, order: inputs(c.req).order, flags: await evaluate(c), filters, query: new URL(c.req.url).searchParams.toString() })));
  app.onError((error, c) => c.json({ error: 'Toggly evaluation unavailable', source: c.get('provenance') }, 503));
  return app;
}
