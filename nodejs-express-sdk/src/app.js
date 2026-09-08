import express from 'express';
import { togglyMiddleware, featureGate, featureRoutes, withFeature, featuresHandler } from '@ops-ai/toggly-express';
import { inputs, keys, filters } from './catalog.js';
import { page } from './view.js';

export function createApp({ appKey = '', environment = 'Production', fixtureUrl, hooks = [] } = {}) {
  const app = express();
  const offline = Boolean(fixtureUrl);
  const configured = Boolean(appKey && appKey !== 'ci-placeholder');
  app.use(togglyMiddleware({
    appKey: offline ? 'offline-fixture' : configured ? appKey : undefined,
    environment, baseUrl: fixtureUrl, verifySignatures: !offline,
    enableStreaming: false, refreshInterval: offline || !configured ? 0 : 180000,
    timeout: 3000, registerContextsOnStartup: false, hooks,
    getContext(req) {
      const input = inputs(req);
      return { identity: input.identity, claims: { role: input.role },
        // Presets are explicit demo overrides. Otherwise adapter fromHttpRequest fills headers.
        ...(input.preset ? { request: { country: input.preset.country, acceptLanguage: input.preset.language, userAgent: input.preset.agent } } : {}) };
    },
  }));
  app.use((req, res, next) => {
    const state = req.toggly.client.state;
    req.provenance = !offline && !configured ? 'Missing app key — defaults only; no network' : state.error ? `${state.definitions.size ? 'Cached' : 'Unavailable'} — definition refresh failed` : offline ? 'Offline fixture — published SDK evaluation, no live Toggly service' : 'Live definitions — signature verified';
    res.set('Cache-Control', 'no-store');
    next();
  });
  const evaluate = async req => Object.fromEntries(await Promise.all(keys.map(async key => [key, await req.toggly.client.isFeatureOn(key, req.toggly.context, inputs(req).order)])));
  app.get('/api/evaluate', async (req, res) => res.json({ source: req.provenance, context: req.toggly.context, order: inputs(req).order, flags: await evaluate(req) }));
  app.get('/api/override', async (req, res) => res.json({ source: req.provenance, ambientBefore: await req.toggly.isFeatureOn('filter-targeting'), override: await req.toggly.client.isFeatureOn('filter-targeting', { ...req.toggly.context, identity: 'alice' }), ambientAfter: await req.toggly.isFeatureOn('filter-targeting'), identity: req.toggly.identity }));
  app.get('/api/features', featuresHandler());
  const result = label => (req, res) => res.json({ result: label, source: req.provenance });
  app.get('/gates/enabled', featureGate({ featureKey: 'new-dashboard' }), result('dashboard v2'));
  app.get('/gates/negate', featureGate({ featureKey: 'api-v2', negate: true }), result('legacy API'));
  for (const requirement of ['all', 'any']) app.get(`/gates/${requirement}`, featureGate({ featureKey: ['new-dashboard', 'api-v2'], requirement }), result(requirement));
  app.get('/gates/beta', featureGate({ featureKey: 'beta-access', redirectTo: '/declarative' }), result('beta'));
  app.use(featureRoutes([{ path: /^\/unique\/route$/, methods: ['GET'], featureKey: 'api-v2', onDisabled: (req, res) => res.status(403).json({ error: 'API v2 disabled', source: req.provenance }) }]));
  app.get('/unique/route', result('featureRoutes'));
  app.get('/unique/wrapped', withFeature('enhanced-submit', result('withFeature')));
  const sections = ['home', 'declarative', 'programmatic', 'identity', 'entity', 'filters', 'unique', 'configuration'];
  app.get(['/', ...sections.map(section => `/${section}`)], async (req, res) => res.type('html').send(page({ section: req.path.slice(1) || 'home', source: req.provenance, context: req.toggly.context, order: inputs(req).order, flags: await evaluate(req), filters, query: new URLSearchParams(req.query).toString() })));
  app.use((error, req, res, next) => { // SDK middleware/gate errors reach Express here.
    res.status(503).json({ error: 'Toggly evaluation unavailable', source: req.provenance ?? 'Middleware initialization or context failed' });
  });
  return app;
}
