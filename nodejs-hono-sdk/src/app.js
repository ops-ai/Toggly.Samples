import { Hono } from 'hono';
import { togglyMiddleware, featureGate, featureRoutes, withFeature, featuresHandler } from '@ops-ai/toggly-hono';
import { inputs, keys, filters } from './catalog.js';
import { page } from './view.js';

// One shared client caches definitions and refreshes them for this process. Each
// request gets its own evaluation context; sharing a client must not share a user.
// The published adapter has one module-level client: run one configured app per process.
export function createApp({ appKey = '', environment = 'Production', fixtureUrl, hooks = [], contextHook } = {}) {
  const app = new Hono();
  const offline = Boolean(fixtureUrl);
  const configured = Boolean(appKey && appKey !== 'ci-placeholder');
  // Set provenance before initialization so even an early error is labelled.
  // These responses depend on request inputs; do not cache them for another user.
  app.use('*', async (c, next) => {
    c.set('provenance', offline ? 'Offline fixture — initialization unavailable' : configured ? 'Configured service — initialization unavailable' : 'Missing app key — defaults only; no network');
    c.header('X-Toggly-Source', c.get('provenance').replaceAll('—', '-'));
    c.header('Cache-Control', 'no-store');
    await next();
  });
  // Register before every route/gate: the adapter awaits one initialization promise
  // and attaches helpers to c.get('toggly'). Initialization alone does not prove a
  // successful fetch; the next middleware inspects the client's error state.
  // No featureDefaults are supplied: unknown/unavailable keys evaluate false.
  app.use('*', togglyMiddleware({
    appKey: offline ? 'offline-fixture' : configured ? appKey : undefined,
    // Environment selects a definition set, not NODE_ENV. Only the loopback
    // fixture disables signatures; configured service traffic requires them.
    environment, baseUrl: fixtureUrl, verifySignatures: !offline,
    enableStreaming: false, refreshInterval: offline || !configured ? 0 : 180000,
    timeout: 3000, registerContextsOnStartup: false, hooks,
    async getContext(c) {
      const input = inputs(c.req);
      // Demo query/header inputs let readers change targeting, not authenticate.
      // In a real app, obtain identity and claims from a trusted session first.
      // The async hook models that lookup without changing shared client identity.
      // The adapter fills missing request fields from headers; preset fields win.
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
  // Adapter helpers accept ambient context only in 0.3.0. Core accepts the Order
  // as a separate third argument, so entity rules see Order.Vip without replacing
  // the request identity/claims. All page rows use this same evaluation path.
  const evaluate = async c => {
    const toggly = c.get('toggly');
    return Object.fromEntries(await Promise.all(keys.map(async key => [key, await toggly.client.isFeatureOn(key, toggly.context, inputs(c.req).order)])));
  };
  app.get('/api/evaluate', async c => c.json({ source: c.get('provenance'), context: c.get('toggly').context, order: inputs(c.req).order, flags: await evaluate(c) }));
  // A one-call override is a new context object. Spreading preserves other
  // targeting fields; never call a shared-client identity setter per request.
  app.get('/api/override', async c => {
    const toggly = c.get('toggly');
    return c.json({ source: c.get('provenance'), ambientBefore: await toggly.isFeatureOn('filter-targeting'), override: await toggly.client.isFeatureOn('filter-targeting', { ...toggly.context, identity: 'alice' }), ambientAfter: await toggly.isFeatureOn('filter-targeting'), identity: toggly.identity });
  });
  // Handler VALUE, not featuresHandler(). Its flags are the shared snapshot,
  // but identity is this request's identity; that pairing is not a user evaluation.
  app.get('/api/features', featuresHandler);
  const result = label => c => c.json({ result: label, source: c.get('provenance') });
  // Gates run before the handler: disabled normally returns 404. Negate inverts
  // the gate result; all needs both flags, any needs at least one. A rollout gate
  // controls availability and does not replace authentication/authorization.
  app.get('/gates/enabled', featureGate({ featureKey: 'new-dashboard' }), result('dashboard v2'));
  app.get('/gates/negate', featureGate({ featureKey: 'api-v2', negate: true }), result('legacy API'));
  for (const requirement of ['all', 'any']) app.get(`/gates/${requirement}`, featureGate({ featureKey: ['new-dashboard', 'api-v2'], requirement }), result(requirement));
  app.get('/gates/beta', featureGate({ featureKey: 'beta-access', redirectTo: '/declarative' }), result('beta'));
  // This anchored path policy applies only to GET. POST deliberately bypasses it;
  // choose methods explicitly when adapting this example to a protected endpoint.
  app.use('*', featureRoutes([{ path: /^\/unique\/route$/, methods: ['GET'], featureKey: 'api-v2', onDisabled: c => c.json({ error: 'API v2 disabled', source: c.get('provenance') }, 403) }]));
  app.get('/unique/route', result('featureRoutes'));
  app.post('/unique/route', result('POST outside GET route policy'));
  // withFeature wraps a handler; it is an alternative to a separate gate middleware.
  app.get('/unique/wrapped', withFeature('enhanced-submit', result('withFeature')));
  const sections = ['home', 'declarative', 'programmatic', 'identity', 'entity', 'filters', 'unique', 'configuration'];
  for (const path of ['/', ...sections.map(section => `/${section}`)]) app.get(path, async c => c.html(page({ section: c.req.path.slice(1) || 'home', source: c.get('provenance'), context: c.get('toggly').context, order: inputs(c.req).order, flags: await evaluate(c), filters, query: new URL(c.req.url).searchParams.toString() })));
  app.onError((error, c) => c.json({ error: 'Toggly evaluation unavailable', source: c.get('provenance') }, 503));
  return app;
}
