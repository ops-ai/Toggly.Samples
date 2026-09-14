import Koa from 'koa';
import Router from '@koa/router';
import { togglyMiddleware, featureGate, featureRoutes, withFeature, featuresHandler } from '@ops-ai/toggly-koa';
import { inputs, keys, filters } from './catalog.js';
import { page } from './view.js';

// Koa shares a downloaded definitions client for the process, but context belongs
// to the request. Keeping it on ctx.state avoids one visitor affecting another.
export function createApp({ appKey = '', environment = 'Production', fixtureUrl, hooks = [], telemetry = true } = {}) {
  const app = new Koa();
  const router = new Router();
  const offline = Boolean(fixtureUrl);
  const configured = Boolean(appKey && appKey !== 'ci-placeholder');

  // This outer boundary turns a failed initialization/evaluation into an honest
  // service response. It must come before the adapter and every feature gate.
  app.use(async (ctx, next) => {
    try { await next(); }
    catch (error) {
      ctx.status = 503;
      ctx.body = { error: 'Toggly evaluation unavailable', source: ctx.state.provenance ?? 'Middleware initialization or context failed' };
    }
  });
  app.use(async (ctx, next) => {
    ctx.set('X-Toggly-Source', offline ? 'Offline fixture' : configured ? 'Configured service' : 'Missing app key');
    await next();
  });
  app.use(togglyMiddleware({
    appKey: offline ? 'offline-fixture' : configured ? appKey : undefined,
    // Only the loopback fixture has unsigned definitions. Live mode verifies them.
    environment, baseUrl: fixtureUrl, verifySignatures: !offline,
    enableStreaming: false, refreshInterval: offline || !configured ? 0 : 180000,
    // Fixture/default runs never report usage. A configured live app retains the
    // SDK defaults; tests can disable telemetry without replacing the evaluator.
    enableUsageTracking: configured && telemetry, enableMetrics: configured && telemetry,
    timeout: 3000, registerContextsOnStartup: false, hooks,
    // This runs for every request. It deliberately does not call a global
    // setIdentity API: a global identity would leak targeting between requests.
    getContext(ctx) {
      const input = inputs(ctx);
      return {
        identity: input.identity,
        claims: { role: input.role },
        // A selected preset replaces HTTP segments so manual exercises are stable.
        ...(input.preset ? { request: { country: input.preset.country, acceptLanguage: input.preset.language, userAgent: input.preset.agent } } : {}),
      };
    },
  }));
  app.use(async (ctx, next) => {
    const state = ctx.state.toggly.client.state;
    const status = state.error ? `${state.definitions.size ? 'Cached' : 'Unavailable'} — definition refresh failed` : 'published SDK evaluation, no live Toggly service';
    ctx.state.provenance = offline ? `Offline fixture — ${status}` : !configured ? 'Missing app key — defaults only; no network' : state.error ? status : 'Live definitions — signature verified';
    ctx.set('X-Toggly-Source', ctx.state.provenance.replaceAll('—', '-'));
    ctx.set('Cache-Control', 'no-store');
    await next();
  });

  // Adapter helpers bind ctx.state.toggly.context. Node core additionally accepts
  // an explicit context and entity, which is necessary for Order-based rules.
  const evaluate = async ctx => Object.fromEntries(await Promise.all(keys.map(async key => [key, await ctx.state.toggly.client.isFeatureOn(key, ctx.state.toggly.context, inputs(ctx).order)])));
  const result = label => async ctx => { ctx.body = { result: label, source: ctx.state.provenance }; };

  router.get('/api/evaluate', async ctx => { ctx.body = { source: ctx.state.provenance, context: ctx.state.toggly.context, order: inputs(ctx).order, flags: await evaluate(ctx) }; });
  // This override creates a new object for one call. The request's ambient context
  // stays unchanged before and after it, proving there is no shared mutation.
  router.get('/api/override', async ctx => {
    ctx.body = {
      source: ctx.state.provenance,
      ambientBefore: await ctx.state.toggly.isFeatureOn('filter-targeting'),
      override: await ctx.state.toggly.client.isFeatureOn('filter-targeting', { ...ctx.state.toggly.context, identity: 'alice' }),
      ambientAfter: await ctx.state.toggly.isFeatureOn('filter-targeting'),
      identity: ctx.state.toggly.identity,
    };
  });
  router.get('/api/features', featuresHandler());

  // A feature gate chooses whether its next handler runs. It is a rollout tool,
  // not authentication or authorization; retain authorization checks separately.
  router.get('/gates/enabled', featureGate({ featureKey: 'new-dashboard' }), result('dashboard v2'));
  router.get('/gates/negate', featureGate({ featureKey: 'api-v2', negate: true }), result('legacy API'));
  for (const requirement of ['all', 'any']) router.get(`/gates/${requirement}`, featureGate({ featureKey: ['new-dashboard', 'api-v2'], requirement }), result(requirement));
  router.get('/gates/beta', featureGate({ featureKey: 'beta-access', redirectTo: '/declarative' }), result('beta'));
  router.get('/unique/route', result('featureRoutes'));
  router.get('/unique/wrapped', withFeature('enhanced-submit', result('withFeature')));

  const sections = ['home', 'declarative', 'programmatic', 'identity', 'entity', 'filters', 'unique', 'configuration'];
  for (const section of ['', ...sections]) router.get(`/${section}`, async ctx => {
    const query = new URLSearchParams(Object.entries(ctx.query).flatMap(([key, value]) => Array.isArray(value) ? value.map(item => [key, item]) : [[key, value]])).toString();
    ctx.type = 'html';
    ctx.body = page({ section: section || 'home', source: ctx.state.provenance, context: ctx.state.toggly.context, order: inputs(ctx).order, flags: await evaluate(ctx), filters, query });
  });

  // Route patterns must run before the router so the adapter can decide whether
  // the router's handler is reachable. Its custom disabled response is a 403.
  app.use(featureRoutes([{ path: /^\/unique\/route$/, methods: ['GET'], featureKey: 'api-v2', onDisabled: async ctx => { ctx.status = 403; ctx.body = { error: 'API v2 disabled', source: ctx.state.provenance }; } }]));
  app.use(router.routes());
  app.use(router.allowedMethods());
  return app;
}
