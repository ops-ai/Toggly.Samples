# Fastify SDK Sample

Standalone server-rendered HTML and HTTP API using published **Fastify 5.12.3**, **@ops-ai/toggly-fastify 0.3.0**, and **@ops-ai/toggly-node-core 0.7.0** (npm latest verified 2026-09-08). Node 22+.

A **feature flag** is a named decision in your application: `new-dashboard` ON renders the new dashboard and OFF renders the classic one. Its key must match the definition exactly. The **app key** selects your Toggly application; the **environment** selects that app's rules (for example, Production). An **evaluation context** supplies who/what this request represents, so one rule can return different results for different people or orders.

## First toggle: follow a decision from rule to response

Start without an account using the fixture:

```sh
cd nodejs-fastify-sdk
npm ci
npm run offline
# Open http://localhost:3000/declarative
```

1. Confirm the **Offline fixture** banner. The initial `new-dashboard` rule is AlwaysOn, so the page shows Dashboard v2. Visit `/gates/enabled`: the same flag permits an HTTP 200 response.
2. In [src/fixture.js](src/fixture.js), remove only `'new-dashboard'` from the AlwaysOn key list and add `rule('new-dashboard', 'AlwaysOff'),` as its own entry in `definitions`. Stop and restart `npm run offline`, then reload. The page now shows Classic dashboard and `/gates/enabled` returns 404. This edit is a local learning exercise; restore it afterward.
3. Open `/filters?preset=matching`, then `/filters?preset=non-matching`. This time the rules stay fixed and the request changes. Targeting matches alice; UserClaims matches admin; the Order filter matches `Vip: true`. AlwaysOn and the open TimeWindow stay ON. Percentage is stable for the same flag key/identity, but a 50% threshold does not guarantee either preset's result.
4. Open `/api/override?identity=bob`: `ambientBefore` is false, the alice `override` is true, and `ambientAfter` is false. A one-call context override does not change bob's next check.
5. For the live equivalent, complete the manual setup below, set `.env.local`, stop offline mode and run `npm run dev`. Toggle `new-dashboard` in the selected environment, wait up to the three-minute refresh interval (plus fetch time) or restart, then reload. The signed Live banner and live behavior still require your own verification.

This is a boolean rollout exercise. The two displayed dashboard “variants” are application branches, not named experiment assignments or measured A/B treatments.

## Read the source in this order

| File | What to follow |
|---|---|
| [src/catalog.js](src/catalog.js) | Exact flag keys, preset inputs, and mapping a demo order to `{ kind, key, attributes }` |
| [src/fixture.js](src/fixture.js) | Rule definitions; an HTTP transport fixture feeding the real published evaluator |
| [src/server.js](src/server.js) | Environment variables, initialization before listening, and shutdown |
| [src/app.js](src/app.js) | Shared client, request-local context, core overrides/entity arguments, gates and source status |
| [src/view.js](src/view.js) | Server-rendered ON/OFF branches and controls that start a new request |
| [test/http.test.js](test/http.test.js) | Observable expectations, including concurrent identities and failed refreshes |

For adapter API details, see the [Fastify documentation](https://docs.toggly.io/sdks/nodejs/fastify). The [Samples catalog](../README.md) lists other frameworks and their status.

## Quick start with local configuration

```sh
cd nodejs-fastify-sdk
npm ci
cp .env.example .env.local
npm run dev
# Open http://localhost:3000
```

`dev` and `start` load `.env`, then `.env.local` (the latter takes precedence). With an empty key or `ci-placeholder`, the app stays navigable, shows a missing-key banner, evaluates defaults, and makes no SDK network requests. Set your own `TOGGLY_APP_KEY` and restart for signed live definitions. Do not commit the key.

```sh
npm run offline
npm run build
npm test
```

Offline mode starts an ephemeral loopback definition server. The **published SDK evaluates all filters**; the fixture only supplies definitions. Every response carries `X-Toggly-Source`, including adapter-owned gates, redirects, snapshots and errors. Offline remains explicitly labelled after failed startup or refresh. Definition-fetch failures display Unavailable or Cached, never Live. Cached means last-known definitions remain in memory; no disk cache is configured here. With no definitions and no custom defaults, checks return OFF. OFF is a valid boolean result, whereas an exception such as failed context extraction produces HTTP 503. Streaming is disabled; configured mode refreshes every three minutes. The plain JavaScript build checks every source module's syntax.

## Sections

| Contract | Page / API | Behavior |
|---|---|---|
| Home | `/` | Navigation, source banner, five baseline and eleven filter flags |
| Declarative | `/declarative`, `/gates/*` | Boolean variants, native featureGate preHandlers, negate, all/any, beta redirect |
| Programmatic | `/programmatic`, `/api/evaluate`, `/api/override` | Request evaluation and one-call alice override |
| Identity | `/identity` | Request identity and claims; no shared identity mutation |
| Entity | `/entity` | Core evaluates Order/Vip for ExpressCheckout |
| Filters | `/filters` | Matching and Non-matching presets, all eleven rows |
| Package-specific | `/unique` | Plugin hooks, featureRoutes, withFeature, featuresHandler |
| Missing configuration | `/configuration` | Visible defaults/offline/live-failure explanation |

Query controls are demonstration inputs, not authentication. Custom HTTP inputs: `x-toggly-identity`, `x-demo-role`, `x-demo-order`, `cf-ipcountry`, `accept-language`, `user-agent`. With no preset, the adapter's actual `fromHttpRequest` fills request segments. Presets deliberately override segments. The active preset, role and Order selections reflect the evaluated values.

## Published capabilities and limits

The adapter registers a `preHandler` for per-request context and an `onClose` hook that closes its client. Native `featureGate`, `featureRoutes`, `withFeature` (a preHandler, not a handler wrapper) and `featuresHandler` are exercised. `getFastifyToggly` is used for lifecycle/refresh checks in tests; normal cleanup is `app.close()`.

The plugin is initialized once before the server listens. Initialization can finish with fallback results after a fetch error; it does not prove the service was reached. Each request then gets its own context in the plugin's `preHandler`, followed by route gates and handlers. `onSend` labels even gate-owned responses and prevents shared response caching; `app.close()` runs the plugin's cleanup.

For the initial fixture, `/gates/enabled`, `/gates/negate`, and `/gates/any` return 200; `/gates/all` returns 404. `all` requires both keys ON, `any` requires one, and `negate` reverses the combined result. Thus the negated `api-v2` check permits the legacy route while that flag is OFF. The beta gate redirects to `/declarative` when disabled. These checks control feature availability, not permission to access protected data.

Adapter 0.3.0 evaluation helpers bind ambient context only, rather than accepting a second context argument. Explicit overrides and Order entities therefore go through `request.toggly.client` with explicit request context. `featuresHandler` returns the global SDK snapshot, not request-specific filter evaluation; compare `/api/evaluate`. No experiment assignment API is published: the dashboard variants are boolean content branches.

The published adapter owns a process-wide client singleton. Run one app/configuration per process; this sample never changes its global identity. Its `onDisabled` callback receives only the request and does not itself stop the route. This sample uses built-in 404 and redirect gate responses instead. No installed artifact is patched.

## Exact Toggly setup (manual, pending sign-in)

Provisioning could not be performed because app.toggly.io requires sign-in. No live app or flag creation is claimed.

1. Sign in, select workspace **Toggly Samples**, create **Fastify SDK Sample**, select Fastify technology (if unavailable, select Node.js and record that choice), environment **Production**. Add origin `http://localhost:3000`.
2. Create context kind **Order**: `Id` string (key), `Vip` boolean, `Total` number. Use `ord-vip` with Vip=true/Total=199 and `ord-standard` with Vip=false/Total=49.
3. Create baseline flags `new-dashboard`, `api-v2`, `enhanced-submit`, `beta-access`. For the initial fixture-equivalent state, enable all except `api-v2`.
4. Create `ExpressCheckout` using ContextProperty `Order.Vip = true`.
5. Create **Filters** category and every row below. Copy the app key into ignored `.env.local`, set `TOGGLY_ENVIRONMENT=Production`, restart `npm run dev`.

| Flag | Rule |
|---|---|
| filter-always-on | AlwaysOn |
| filter-percentage | Percentage 50%, sticky by identity |
| filter-targeting | Targeting users alice |
| filter-user-claims | UserClaims role=admin |
| filter-time-window | TimeWindow 2020-01-01 through 2099-12-31 |
| filter-country | Country US |
| filter-browser-family | BrowserFamily Chrome |
| filter-browser-language | BrowserLanguage en |
| filter-device-type | DeviceType Macintosh |
| filter-os | OperatingSystem Mac |
| filter-context-property | ContextProperty Order.Vip=true |

Presets use the exact identities, claims and User-Agent strings in [FLAG_TEMPLATE](../docs/FLAG_TEMPLATE.md). Matching is alice/admin/US/English/Chrome on macOS/ord-vip; Non-matching is bob/user/CA/French/Firefox on Windows/ord-standard. AlwaysOn and open TimeWindow remain on; Percentage is sticky, not prescribed. All eleven filters are exercised locally with core 0.7.0.

## Verification and pending live checklist

Offline HTTP tests start actual Fastify/listener and loopback fixture servers; they cover all HTML pages, active controls, filter matrix, 30 concurrent requests with asynchronous evaluation hooks, overrides, gate changes/redirects, signature rejection, missing-key no-network, failed initialization/refresh provenance, hook errors and automatic singleton cleanup.

Live checks remain **pending**, independently of local test results:

- [ ] Provision the exact app/context/flags above and verify signed Live banner.
- [ ] Visit all eight sections; apply both presets and verify matrix/Order results.
- [ ] Toggle baseline flags in the dashboard, wait for refresh or restart, verify boolean branches and enabled/negate/all/any/beta routes.
- [ ] Compare `/api/features` snapshot with `/api/evaluate`; verify bob override leaves ambient identity unchanged.
- [ ] Remove app key and restart: visible missing-key banner, no SDK network.
- [ ] Simulate service failure after loading: visibly Cached; with no prior definitions: Unavailable.

Humans review live results; local fixture tests are not evidence of a provisioned/live app.
