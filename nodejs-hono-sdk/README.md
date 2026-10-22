# Node Hono SDK sample

Runnable Hono app that shows how Toggly attaches evaluation helpers to each request via `@ops-ai/toggly-hono` middleware. Requires Node 22+.

## Quick start

```sh
cd nodejs-hono-sdk
npm ci
cp .env.example .env.local
```

Set `TOGGLY_APP_KEY` in `.env.local`, then:

```sh
npm run dev
# http://localhost:3000
```

Without a key the app runs with defaults only (no network). Try offline mode with no account:

```sh
npm run offline
```

## How it works

Apply `togglyMiddleware` on all routes before gates. Context comes from `getContext`:

```js
import { togglyMiddleware, featureGate, featuresHandler } from '@ops-ai/toggly-hono';

app.use('*', togglyMiddleware({
  appKey: process.env.TOGGLY_APP_KEY,
  environment: process.env.TOGGLY_ENVIRONMENT ?? 'Production',
  async getContext(c) {
    const input = inputs(c.req);
    return {
      identity: input.identity,
      claims: { role: input.role },
      ...(input.preset ? { request: { country: input.preset.country, acceptLanguage: input.preset.language, userAgent: input.preset.agent } } : {}),
    };
  },
}));
```

**Check a flag** (ambient context):

```js
const toggly = c.get('toggly');
const on = await toggly.isFeatureOn('new-dashboard');
```

**Gate a route**:

```js
app.get('/gates/enabled', featureGate({ featureKey: 'new-dashboard' }), handler);
```

**Entity (Order)** via core client ([OPS-2000](https://linear.app/opsai/issue/OPS-2000)):

```js
await toggly.client.isFeatureOn(key, toggly.context, inputs(c.req).order);
```

**Register `featuresHandler`** as a handler value (not a factory call):

```js
app.get('/api/features', featuresHandler);
```

`featuresHandler` exposes a global snapshot, not per-request evaluation ([OPS-2001](https://linear.app/opsai/issue/OPS-2001)). Experiments are boolean-only in Node packages ([OPS-2002](https://linear.app/opsai/issue/OPS-2002)).

Call `closeHonoToggly()` when the process exits (`src/server.js`). One configured app per process.

## Tour

| Section | Route | What you see |
| --- | --- | --- |
| Home | `/` | Navigation and results |
| Declarative | `/declarative`, `/gates/*` | Variants and gates |
| Programmatic | `/programmatic` | Evaluate and override APIs |
| Identity | `/identity` | Targeting controls |
| Entity | `/entity` | Express checkout vs standard |
| Filters | `/filters` | Eleven filters, two presets |
| Package helpers | `/unique` | Routes, `withFeature`, snapshot handler |
| Configuration | `/configuration` | Setup banner |

```sh
curl 'http://localhost:3000/api/evaluate?preset=matching'
curl 'http://localhost:3000/api/override?identity=bob'
curl -i 'http://localhost:3000/gates/all'
```

Flag definitions for live mode: [FLAG_TEMPLATE.md](../docs/FLAG_TEMPLATE.md).

## Learn more

- [Hono SDK guide](https://docs.toggly.io/sdks/nodejs/hono)
- [Shared flag template](../docs/FLAG_TEMPLATE.md)
- [Samples catalog](../README.md)

## For maintainers

`npm test`, `npm run build`. See `src/app.js` for middleware order and `featureRoutes` GET-only policy on `/unique/route`.
