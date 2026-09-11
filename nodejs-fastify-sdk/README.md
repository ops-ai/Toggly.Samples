# Fastify SDK Sample

Standalone server-rendered HTML and HTTP API using published **Fastify 5.12.3**, **@ops-ai/toggly-fastify 0.3.0**, and **@ops-ai/toggly-node-core 0.7.0** (npm latest verified 2026-09-08). Node 22+.

## Quick start

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

Offline mode starts an ephemeral loopback definition server. The **published SDK evaluates all filters**; the fixture only supplies definitions. Every response carries `X-Toggly-Source`, including adapter-owned gates, redirects, snapshots and errors. Offline remains explicitly labelled after failed startup or refresh. Configured failures display Unavailable or Cached, never Live. Streaming is disabled; configured mode refreshes every three minutes. The plain JavaScript build checks every source module's syntax.

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

Adapter 0.3.0 evaluation helpers bind ambient context only, despite the documentation's override example. Explicit overrides and Order entities therefore go through `request.toggly.client` with explicit request context. `featuresHandler` returns the global SDK snapshot, not request-specific filter evaluation; compare `/api/evaluate`. No experiment assignment API is published: the dashboard variants are boolean content branches.

The published adapter owns a process-wide client singleton. Run one app/configuration per process; this sample never changes its global identity. Its `onDisabled` callback receives only the request and does not itself stop the route. This sample uses built-in 404 and redirect gate responses instead. No installed artifact is patched.

## Create the Toggly application

1. Sign in at [app.toggly.io](https://app.toggly.io). Use a workspace you can manage (the one from signup is enough). Create **Fastify SDK Sample**, select Fastify technology (if unavailable, select Node.js and record that choice), environment **Production**. Add origin `http://localhost:3000`.
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
