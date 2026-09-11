import express from 'express';
import { togglyMiddleware, featureGate, featureRoutes, withFeature, featuresHandler } from '@ops-ai/toggly-express';
import { inputs, keys, filters } from './catalog.js';
import { page } from './view.js';

// Read catalog.js first: keys identify remotely configured rules, not local switches.
// Express owns one shared SDK client per process. Its definitions can be reused by
// every request; the identity/claims/Order used to evaluate them must stay local.
export function createApp({ appKey = '', environment = 'Production', fixtureUrl, hooks = [] } = {}) {
  const app = express();
  const offline = Boolean(fixtureUrl);
  // Missing/demo-placeholder keys deliberately select SDK defaults. No featureDefaults
  // are supplied here, so a key without a fetched definition evaluates false.
  const configured = Boolean(appKey && appKey !== 'ci-placeholder');
  app.use((req, res, next) => {
    res.set('X-Toggly-Source', offline ? 'Offline fixture' : configured ? 'Configured service' : 'Missing app key');
    next();
  });
  // Install before any evaluation or gate. The published middleware initializes
  // lazily on the first request and awaits initialization before attaching req.toggly.
  // Initialization completing is not proof of a successful fetch: inspect state.error.
  app.use(togglyMiddleware({
    appKey: offline ? 'offline-fixture' : configured ? appKey : undefined,
    // App key + environment select the definition set; they do not identify a user.
    // Only the loopback fixture opts out of signatures. Live mode verifies signatures.
    environment, baseUrl: fixtureUrl, verifySignatures: !offline,
    // Live definitions refresh every three minutes; requests evaluate them locally.
    // Offline/default-only runs have no poll timer. Context schema setup is manual.
    enableStreaming: false, refreshInterval: offline || !configured ? 0 : 180000,
    timeout: 3000, registerContextsOnStartup: false, hooks,
    // Called for each request: targeting claims are not authentication/authorization.
    // A real app should derive these from its trusted session, not demo query fields.
    // Do not call client.setIdentity here: that would mutate the process-wide client.
    getContext(req) {
      const input = inputs(req);
      return { identity: input.identity, claims: { role: input.role },
        // Presets are explicit demo overrides. Otherwise adapter fromHttpRequest fills headers.
        ...(input.preset ? { request: { country: input.preset.country, acceptLanguage: input.preset.language, userAgent: input.preset.agent } } : {}) };
    },
  }));
  // The banner/header describe where the rules came from, not whether a flag is ON.
  // A failed refresh can still evaluate last-known-good definitions in memory; this
  // sample has no persistent cache provider, so a fresh failed startup has no rules.
  app.use((req, res, next) => {
    const state = req.toggly.client.state;
    const status = state.error ? `${state.definitions.size ? 'Cached' : 'Unavailable'} — definition refresh failed` : 'published SDK evaluation, no live Toggly service';
    req.provenance = offline ? `Offline fixture — ${status}` : !configured ? 'Missing app key — defaults only; no network' : state.error ? status : 'Live definitions — signature verified';
    // HTTP headers use ASCII; preserve the same mode/status on SDK-owned responses.
    res.set('X-Toggly-Source', req.provenance.replaceAll('—', '-'));
    res.set('Cache-Control', 'no-store');
    next();
  });
  // Adapter 0.2.0 request helpers bind ambient context only. Core 0.7.0 accepts
  // (key, evaluationContext, entity), so pass both explicitly for Order-based rules.
  // This evaluates the same definitions for each request without changing the client.
  const evaluate = async req => Object.fromEntries(await Promise.all(keys.map(async key => [key, await req.toggly.client.isFeatureOn(key, req.toggly.context, inputs(req).order)])));
  app.get('/api/evaluate', async (req, res) => res.json({ source: req.provenance, context: req.toggly.context, order: inputs(req).order, flags: await evaluate(req) }));
  // The spread preserves request claims/HTTP fields while replacing only identity
  // for this call. bob stays bob before and after the temporary alice evaluation.
  app.get('/api/override', async (req, res) => res.json({ source: req.provenance, ambientBefore: await req.toggly.isFeatureOn('filter-targeting'), override: await req.toggly.client.isFeatureOn('filter-targeting', { ...req.toggly.context, identity: 'alice' }), ambientAfter: await req.toggly.isFeatureOn('filter-targeting'), identity: req.toggly.identity }));
  // featuresHandler returns a shared boolean snapshot plus the REQUEST identity.
  // That identity does not make the snapshot personalized. Use /api/evaluate when
  // claims, HTTP segments or an Order should influence the returned flag results.
  app.get('/api/features', featuresHandler());
  const result = label => (req, res) => res.json({ result: label, source: req.provenance });
  // A gate chooses whether the next route handler runs; it does not grant permission.
  // Keep application authentication/authorization independent of feature rollout.
  // Disabled gates return 404 by default. Negate inverts the combined gate result:
  // api-v2 OFF therefore allows the legacy route below.
  app.get('/gates/enabled', featureGate({ featureKey: 'new-dashboard' }), result('dashboard v2'));
  app.get('/gates/negate', featureGate({ featureKey: 'api-v2', negate: true }), result('legacy API'));
  // all needs both keys ON; any needs at least one ON. The fixture has dashboard
  // ON and api-v2 OFF, making /gates/all deny and /gates/any allow the handler.
  for (const requirement of ['all', 'any']) app.get(`/gates/${requirement}`, featureGate({ featureKey: ['new-dashboard', 'api-v2'], requirement }), result(requirement));
  // A redirect replaces the default 404 when beta is OFF (302 by default).
  app.get('/gates/beta', featureGate({ featureKey: 'beta-access', redirectTo: '/declarative' }), result('beta'));
  // featureRoutes must precede the handler it gates. This anchored regex matches
  // exactly one path, and methods limits it to GET. The custom denial is 403 here.
  app.use(featureRoutes([{ path: /^\/unique\/route$/, methods: ['GET'], featureKey: 'api-v2', onDisabled: (req, res) => res.status(403).json({ error: 'API v2 disabled', source: req.provenance }) }]));
  app.get('/unique/route', result('featureRoutes'));
  // withFeature wraps the handler in a gate instead of registering separate middleware.
  app.get('/unique/wrapped', withFeature('enhanced-submit', result('withFeature')));
  const sections = ['home', 'declarative', 'programmatic', 'identity', 'entity', 'filters', 'unique', 'configuration'];
  app.get(['/', ...sections.map(section => `/${section}`)], async (req, res) => res.type('html').send(page({ section: req.path.slice(1) || 'home', source: req.provenance, context: req.toggly.context, order: inputs(req).order, flags: await evaluate(req), filters, query: new URLSearchParams(req.query).toString() })));
  app.use((error, req, res, next) => { // SDK middleware/gate errors reach Express here.
    res.status(503).json({ error: 'Toggly evaluation unavailable', source: req.provenance ?? 'Middleware initialization or context failed' });
  });
  return app;
}
