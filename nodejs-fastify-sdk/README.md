# Node Fastify SDK sample

Runnable Fastify app that registers the `@ops-ai/toggly-fastify` plugin, evaluates flags per request in `request.toggly`, and demonstrates gates and HTML sections. Requires Node 22+.

## Quick start

```sh
cd nodejs-fastify-sdk
npm ci
cp .env.example .env.local
```

Set `TOGGLY_APP_KEY` in `.env.local`, then:

```sh
npm run dev
# http://localhost:3000
```

Without a key you get a missing-key banner and OFF defaults. Offline demo:

```sh
npm run offline
```

## How it works

Register the plugin before routes so each request gets `request.toggly` in a `preHandler`:

```js
import { togglyPlugin, featureGate, featuresHandler } from '@ops-ai/toggly-fastify';

await app.register(togglyPlugin, {
  appKey: process.env.TOGGLY_APP_KEY,
  environment: process.env.TOGGLY_ENVIRONMENT ?? 'Production',
  async getContext(request) {
    const input = inputs(request);
    return {
      identity: input.identity,
      claims: { role: input.role },
      ...(input.preset ? { request: { country: input.preset.country, acceptLanguage: input.preset.language, userAgent: input.preset.agent } } : {}),
    };
  },
});
```

**Check a flag**:

```js
const on = await request.toggly.isFeatureOn('new-dashboard');
```

**Gate a route** with a `preHandler`:

```js
app.get('/gates/enabled', { preHandler: featureGate({ featureKey: 'new-dashboard' }) }, handler);
```

**Entity (Order)** through the core client ([OPS-2000](https://linear.app/opsai/issue/OPS-2000)):

```js
await request.toggly.client.isFeatureOn(key, request.toggly.context, inputs(request).order);
```

**Features JSON** — global snapshot, not request-evaluated ([OPS-2001](https://linear.app/opsai/issue/OPS-2001)):

```js
app.get('/api/features', featuresHandler);
```

Boolean UI branches here are not experiment assignments ([OPS-2002](https://linear.app/opsai/issue/OPS-2002)). Shut down with `app.close()` so the plugin releases its client (`src/server.js`). One app configuration per process.

## Tour

| Section | Route | What you see |
| --- | --- | --- |
| Home | `/` | Navigation and flag list |
| Declarative | `/declarative`, `/gates/*` | Variants and gates |
| Programmatic | `/programmatic` | `/api/evaluate`, `/api/override` |
| Identity | `/identity` | Identity and claims |
| Entity | `/entity` | Order / VIP checkout |
| Filters | `/filters` | Presets and filter rows |
| Package helpers | `/unique` | Plugin hooks and route helpers |
| Configuration | `/configuration` | Missing-key explanation |

```sh
curl 'http://localhost:3000/api/evaluate?preset=matching'
curl 'http://localhost:3000/api/override?identity=bob'
curl -i 'http://localhost:3000/gates/all'
```

Create matching flags with [FLAG_TEMPLATE.md](../docs/FLAG_TEMPLATE.md).

## Learn more

- [Fastify SDK guide](https://docs.toggly.io/sdks/nodejs/fastify)
- [Shared flag template](../docs/FLAG_TEMPLATE.md)
- [Samples catalog](../README.md)

## For maintainers

`npm test`, `npm run build`. Plugin registration and evaluation: `src/app.js`.
