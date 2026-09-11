import Fastify from 'fastify';
import { togglyPlugin, featureGate, featureRoutes, withFeature, featuresHandler } from '@ops-ai/toggly-fastify';
import { inputs, keys, filters } from './catalog.js';
import { page } from './view.js';

// Published adapter uses one process-wide client: run one sample instance per process.
export async function createApp({ appKey = '', environment = 'Production', fixtureUrl, baseUrl, hooks = [], getContext } = {}) {
  const app = Fastify();
  // A flag key names one decision; appKey + environment select its definitions.
  // Offline replaces only the definition transport. An absent/placeholder app key
  // selects defaults: no featureDefaults are provided here, so unknown flags are OFF.
  const offline = Boolean(fixtureUrl);
  const configured = Boolean(appKey && appKey !== 'ci-placeholder');
  // Initialization can finish with an error and fallback results. Report the SDK's
  // state, not merely the presence of credentials. Cached means retained definitions
  // in this process; this sample does not configure a persistent disk cache.
  const source = request => {
    const state = request.toggly?.client.state;
    const status = state?.error ? `${state.definitions.size ? 'Cached' : 'Unavailable'} - definition refresh failed` : 'published SDK evaluation, no live Toggly service';
    return offline ? `Offline fixture - ${status}` : !configured ? 'Missing app key - defaults only; no network' : state?.error ? status : state ? 'Live definitions - signature verified' : 'Configured service - evaluation unavailable';
  };
  // onSend also covers SDK-owned gates, error handlers and Fastify 404 responses.
  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Toggly-Source', source(request));
    reply.header('Cache-Control', 'no-store');
    return payload;
  });
  // Register before routes so the plugin initializes its shared client and installs
  // a preHandler that attaches a fresh context/helpers to every request. Reuse the
  // definition cache, not a user's identity: never setIdentity for each request.
  await app.register(togglyPlugin, {
    // Signed live definitions are verified; only our unsigned loopback fixture opts
    // out. Disabling streaming makes live changes arrive on the 3-minute poll.
    // Context registration is off: these prepared Order objects need no startup write.
    appKey: offline ? 'offline-fixture' : configured ? appKey : undefined,
    environment, baseUrl: fixtureUrl ?? baseUrl, verifySignatures: !offline,
    enableStreaming: false, refreshInterval: offline || !configured ? 0 : 180000,
    timeout: 3000, registerContextsOnStartup: false, hooks,
    // Demo controls let readers impersonate targeting inputs. In a real service,
    // derive identity/claims from a trusted session; feature gates are not login checks.
    // The adapter fills missing request fields from HTTP headers. A preset supplies
    // country/language/userAgent explicitly, overriding those individual fields.
    getContext: getContext ?? (async request => {
      const input = inputs(request);
      return { identity: input.identity, claims: { role: input.role },
        ...(input.preset ? { request: { country: input.preset.country, acceptLanguage: input.preset.language, userAgent: input.preset.agent } } : {}) };
    }),
  });
  // request.toggly.isFeatureOn accepts only a key in adapter 0.3.0. The core client
  // escape hatch accepts (key, evaluationContext, entity). Pass BOTH the request
  // context and its Order; otherwise entity filters cannot see Order.Vip.
  // Promise.all is safe here because we pass context, rather than mutating a singleton.
  const evaluate = async request => Object.fromEntries(await Promise.all(keys.map(async key => [key, await request.toggly.client.isFeatureOn(key, request.toggly.context, inputs(request).order)])));
  app.get('/api/evaluate', async request => ({ source: source(request), context: request.toggly.context, order: inputs(request).order, flags: await evaluate(request) }));
  // Copy the ambient context for one call; replacing identity does not change the
  // request helpers. With bob, this demonstrates false -> true (alice) -> false.
  app.get('/api/override', async request => ({ source: source(request), ambientBefore: await request.toggly.isFeatureOn('filter-targeting'), override: await request.toggly.client.isFeatureOn('filter-targeting', { ...request.toggly.context, identity: 'alice' }), ambientAfter: await request.toggly.isFeatureOn('filter-targeting'), identity: request.toggly.identity }));
  // This SDK handler exposes a global snapshot computed without this request's
  // claims/Order. /api/evaluate is the endpoint for personalized flag results.
  app.get('/api/features', featuresHandler);
  const result = label => async request => ({ result: label, source: source(request) });
  // A preHandler decides whether Fastify reaches the route handler. Disabled gates
  // normally send 404; beta chooses a redirect. They do not authenticate callers.
  // negate reverses the final decision: api-v2 OFF permits the legacy route.
  // all needs both keys ON; any needs at least one. With the initial fixture,
  // enabled/negate/any succeed and all fails. No second UI-side decision is needed.
  app.get('/gates/enabled', { preHandler: featureGate({ featureKey: 'new-dashboard' }) }, result('dashboard v2'));
  app.get('/gates/negate', { preHandler: featureGate({ featureKey: 'api-v2', negate: true }) }, result('legacy API'));
  for (const requirement of ['all', 'any']) app.get(`/gates/${requirement}`, { preHandler: featureGate({ featureKey: ['new-dashboard', 'api-v2'], requirement }) }, result(requirement));
  app.get('/gates/beta', { preHandler: featureGate({ featureKey: 'beta-access', redirectTo: '/declarative' }) }, result('beta'));
  // featureRoutes matches request URL/method before gating. withFeature is another
  // preHandler factory, not a function that wraps the result handler.
  app.get('/unique/route', { preHandler: featureRoutes([{ path: /^\/unique\/route(?:\?|$)/, methods: ['GET'], featureKey: 'api-v2' }]) }, result('featureRoutes'));
  app.get('/unique/wrapped', { preHandler: withFeature('enhanced-submit') }, result('withFeature'));
  const sections = ['home', 'declarative', 'programmatic', 'identity', 'entity', 'filters', 'unique', 'configuration'];
  for (const path of ['/', ...sections.map(section => `/${section}`)]) app.get(path, async (request, reply) => reply.type('text/html').send(page({ section: path.slice(1) || 'home', source: source(request), context: request.toggly.context, order: inputs(request).order, flags: await evaluate(request), filters, query: new URLSearchParams(request.query).toString() })));
  // Exceptions (for example context extraction failures) become 503. A normal OFF
  // result instead follows its gate/boolean branch; it is not an evaluation exception.
  app.setErrorHandler((error, request, reply) => reply.status(503).send({ error: 'Toggly evaluation unavailable', source: source(request) }));
  return app;
}
