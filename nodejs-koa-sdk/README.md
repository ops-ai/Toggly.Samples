# Node Koa SDK sample

Runnable Koa app that shows how Toggly loads flag definitions, builds **per-request** evaluation context on `ctx.state.toggly`, and gates routes with `@ops-ai/toggly-koa`. Requires Node 22+.

## Quick start

```sh
cd nodejs-koa-sdk
npm ci
cp .env.example .env.local
```

Set `TOGGLY_APP_KEY` in `.env.local` and run:

```sh
npm run dev
# http://localhost:3000
```

Without a key the app still runs with a configuration banner and no network. For a local demo:

```sh
npm run offline
```

## How it works

Register middleware before routers and gates. `getContext` supplies identity and claims per request:

```js
import { togglyMiddleware, featureGate, featuresHandler } from '@ops-ai/toggly-koa';

app.use(togglyMiddleware({
  appKey: process.env.TOGGLY_APP_KEY,
  environment: process.env.TOGGLY_ENVIRONMENT ?? 'Production',
  getContext(ctx) {
    const input = inputs(ctx);
    return {
      identity: input.identity,
      claims: { role: input.role },
      ...(input.preset ? { request: { country: input.preset.country, acceptLanguage: input.preset.language, userAgent: input.preset.agent } } : {}),
    };
  },
}));
```

**Check a flag** for the current request:

```js
const on = await ctx.state.toggly.isFeatureOn('new-dashboard');
```

**Gate a route**:

```js
router.get('/gates/enabled', featureGate({ featureKey: 'new-dashboard' }), handler);
```

**Entity context (Order)** — use the core client ([OPS-2000](https://linear.app/opsai/issue/OPS-2000)):

```js
await ctx.state.toggly.client.isFeatureOn(key, ctx.state.toggly.context, inputs(ctx).order);
```

**Identity override for one call**:

```js
await ctx.state.toggly.client.isFeatureOn('filter-targeting', { ...ctx.state.toggly.context, identity: 'alice' });
```

Expose a global snapshot (not request-evaluated flags) with `router.get('/api/features', featuresHandler())`.

Call `closeKoaToggly()` on process shutdown (`src/server.js`). One configured Toggly app per Node process.

### SDK limitations

| Topic | Behavior | Tracking |
| --- | --- | --- |
| Per-call context / entity on adapter helpers | Use `ctx.state.toggly.client.isFeatureOn(key, context, entity)` | [OPS-2000](https://linear.app/opsai/issue/OPS-2000) |
| `featuresHandler()` | Global snapshot, not request-evaluated flags | [OPS-2001](https://linear.app/opsai/issue/OPS-2001) |
| Experiments | Boolean branches only | [OPS-2002](https://linear.app/opsai/issue/OPS-2002) |

## Tour

| Section | Route | What you see |
| --- | --- | --- |
| Home | `/` | Navigation and flag checklist |
| Declarative | `/declarative`, `/gates/*` | Variants and HTTP gates |
| Programmatic | `/programmatic` | `/api/evaluate`, `/api/override` |
| Identity | `/identity` | Request targeting inputs |
| Entity | `/entity` | Order-based checkout |
| Filters | `/filters` | Filter matrix presets |
| Package helpers | `/unique` | `featureRoutes`, `withFeature`, `featuresHandler` |
| Configuration | `/configuration` | Missing-key help |

```sh
curl 'http://localhost:3000/api/evaluate?preset=matching'
curl 'http://localhost:3000/api/override?identity=bob'
curl -i 'http://localhost:3000/gates/all'
```

Live flags: [FLAG_TEMPLATE.md](../docs/FLAG_TEMPLATE.md).

## Learn more

- [Koa SDK guide](https://docs.toggly.io/sdks/nodejs/koa)
- [Shared flag template](../docs/FLAG_TEMPLATE.md)
- [Samples catalog](../README.md)

## For maintainers

`npm test`, `npm run build`. Main wiring: `src/app.js`, `src/catalog.js`, `src/fixture.js`.
