# Node Express SDK sample

Runnable Express app that shows how Toggly loads flag definitions, builds **per-request** evaluation context, and gates routes or HTML with the published `@ops-ai/toggly-express` adapter. Requires Node 22+.

## Quick start

```sh
cd nodejs-express-sdk
npm ci
cp .env.example .env.local
```

Set `TOGGLY_APP_KEY` in `.env.local` (from [app.toggly.io](https://app.toggly.io)) and run:

```sh
npm run dev
# http://localhost:3000
```

Without a key the app still runs: it shows a configuration banner and evaluates flags as OFF (no network). For a local demo with no account:

```sh
npm run offline
```

Offline mode serves flag definitions from a loopback fixture; the same published SDK evaluates them.

## How it works

Install the adapter middleware **before** routes that read flags. Use `getContext` to map each request to identity, claims, and optional HTTP segment fields:

```js
import { togglyMiddleware, featureGate, featuresHandler } from '@ops-ai/toggly-express';

app.use(togglyMiddleware({
  appKey: process.env.TOGGLY_APP_KEY,
  environment: process.env.TOGGLY_ENVIRONMENT ?? 'Production',
  getContext(req) {
    const input = inputs(req); // src/catalog.js — demo query/headers, not auth
    return {
      identity: input.identity,
      claims: { role: input.role },
      ...(input.preset ? { request: { country: input.preset.country, acceptLanguage: input.preset.language, userAgent: input.preset.agent } } : {}),
    };
  },
}));
```

**Check a flag** for the current request (ambient context from middleware):

```js
const on = await req.toggly.isFeatureOn('new-dashboard');
```

**Gate a route** so the handler runs only when a flag is on (disabled → 404 by default):

```js
app.get('/gates/enabled', featureGate({ featureKey: 'new-dashboard' }), handler);
```

**Entity context (Order)** — rules that use `Order.Vip` need the core client; adapter helpers only accept a key ([OPS-2000](https://linear.app/opsai/issue/OPS-2000)):

```js
await req.toggly.client.isFeatureOn('ExpressCheckout', req.toggly.context, orderEntity);
```

**One-off identity override** (does not change the request’s ambient identity):

```js
await req.toggly.client.isFeatureOn('filter-targeting', { ...req.toggly.context, identity: 'alice' });
```

On shutdown, call `closeExpressToggly()` once per process (see `src/server.js`). Use one configured Toggly app per Node process.

### SDK limitations (workarounds in this sample)

| Topic | Behavior | Tracking |
| --- | --- | --- |
| Per-call context / entity on `req.toggly.isFeatureOn` | Not supported; use `req.toggly.client.isFeatureOn(key, context, entity)` | [OPS-2000](https://linear.app/opsai/issue/OPS-2000) |
| `featuresHandler()` | Returns a global boolean snapshot plus request identity, not flags evaluated for this request’s claims or Order | [OPS-2001](https://linear.app/opsai/issue/OPS-2001) |
| Experiments | Boolean branches only; no experiment enrollment/exposure API | [OPS-2002](https://linear.app/opsai/issue/OPS-2002) |

Compare `/api/features` with `/api/evaluate` in the running app.

## Tour

| Section | Route | What you see |
| --- | --- | --- |
| Home | `/` | Navigation and flag checklist |
| Declarative | `/declarative`, `/gates/*` | HTML variants and HTTP gates (enabled, negate, all/any, beta redirect) |
| Programmatic | `/programmatic` | JSON evaluation and identity override |
| Identity | `/identity` | Editable identity, role, and HTTP context |
| Entity | `/entity` | Checkout branches with VIP vs standard Order |
| Filters | `/filters` | Eleven filter types with matching / non-matching presets |
| Package helpers | `/unique` | `featureRoutes`, `withFeature`, `featuresHandler` |
| Configuration | `/configuration` | Missing-key and setup notes |

```sh
curl 'http://localhost:3000/api/evaluate?preset=matching'
curl 'http://localhost:3000/api/evaluate?preset=non-matching'
curl 'http://localhost:3000/api/override?identity=bob'
curl -i 'http://localhost:3000/gates/all'
```

Provision live flags with [FLAG_TEMPLATE.md](../docs/FLAG_TEMPLATE.md) (context kind **Order**, baseline + Filters category).

## Learn more

- [Express SDK guide](https://docs.toggly.io/sdks/nodejs/express)
- [Shared flag template](../docs/FLAG_TEMPLATE.md)
- [Samples catalog](../README.md)

## For maintainers

`npm test` (HTTP + fixture), `npm run build` (syntax check). Source map: `src/app.js` (adapter wiring), `src/catalog.js` (keys and presets), `src/fixture.js` (offline definitions).
