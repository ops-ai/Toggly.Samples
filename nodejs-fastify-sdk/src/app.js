import Fastify from 'fastify';
import { togglyPlugin, featureGate, featureRoutes, withFeature, featuresHandler } from '@ops-ai/toggly-fastify';
import { inputs, keys, filters } from './catalog.js';
import { page } from './view.js';

// Published adapter uses one process-wide client: run one sample instance per process.
export async function createApp({ appKey = '', environment = 'Production', fixtureUrl, baseUrl, hooks = [], getContext } = {}) {
  const app = Fastify();
  const offline = Boolean(fixtureUrl);
  const configured = Boolean(appKey && appKey !== 'ci-placeholder');
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
  await app.register(togglyPlugin, {
    appKey: offline ? 'offline-fixture' : configured ? appKey : undefined,
    environment, baseUrl: fixtureUrl ?? baseUrl, verifySignatures: !offline,
    enableStreaming: false, refreshInterval: offline || !configured ? 0 : 180000,
    timeout: 3000, registerContextsOnStartup: false, hooks,
    getContext: getContext ?? (async request => {
      const input = inputs(request);
      return { identity: input.identity, claims: { role: input.role },
        ...(input.preset ? { request: { country: input.preset.country, acceptLanguage: input.preset.language, userAgent: input.preset.agent } } : {}) };
    }),
  });
  const evaluate = async request => Object.fromEntries(await Promise.all(keys.map(async key => [key, await request.toggly.client.isFeatureOn(key, request.toggly.context, inputs(request).order)])));
  app.get('/api/evaluate', async request => ({ source: source(request), context: request.toggly.context, order: inputs(request).order, flags: await evaluate(request) }));
  app.get('/api/override', async request => ({ source: source(request), ambientBefore: await request.toggly.isFeatureOn('filter-targeting'), override: await request.toggly.client.isFeatureOn('filter-targeting', { ...request.toggly.context, identity: 'alice' }), ambientAfter: await request.toggly.isFeatureOn('filter-targeting'), identity: request.toggly.identity }));
  app.get('/api/features', featuresHandler);
  const result = label => async request => ({ result: label, source: source(request) });
  app.get('/gates/enabled', { preHandler: featureGate({ featureKey: 'new-dashboard' }) }, result('dashboard v2'));
  app.get('/gates/negate', { preHandler: featureGate({ featureKey: 'api-v2', negate: true }) }, result('legacy API'));
  for (const requirement of ['all', 'any']) app.get(`/gates/${requirement}`, { preHandler: featureGate({ featureKey: ['new-dashboard', 'api-v2'], requirement }) }, result(requirement));
  app.get('/gates/beta', { preHandler: featureGate({ featureKey: 'beta-access', redirectTo: '/declarative' }) }, result('beta'));
  app.get('/unique/route', { preHandler: featureRoutes([{ path: /^\/unique\/route(?:\?|$)/, methods: ['GET'], featureKey: 'api-v2' }]) }, result('featureRoutes'));
  app.get('/unique/wrapped', { preHandler: withFeature('enhanced-submit') }, result('withFeature'));
  const sections = ['home', 'declarative', 'programmatic', 'identity', 'entity', 'filters', 'unique', 'configuration'];
  for (const path of ['/', ...sections.map(section => `/${section}`)]) app.get(path, async (request, reply) => reply.type('text/html').send(page({ section: path.slice(1) || 'home', source: source(request), context: request.toggly.context, order: inputs(request).order, flags: await evaluate(request), filters, query: new URLSearchParams(request.query).toString() })));
  app.setErrorHandler((error, request, reply) => reply.status(503).send({ error: 'Toggly evaluation unavailable', source: source(request) }));
  return app;
}
