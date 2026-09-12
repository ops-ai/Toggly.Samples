# SvelteKit SDK Sample

A complete feature flag walkthrough using `@ops-ai/toggly-sveltekit` 0.1.x, Svelte5, SvelteKit2 and adapter-node on Node22.12+. The server uses Node core for request evaluation; the browser hydrates an explicitly exposed frontend snapshot and receives signed updates.

## Quick start

```sh
npm install
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173. With empty keys the missing-key banner stays visible and the server exercises explicitly labelled offline definitions. This is a local teaching mode, not evidence of live provisioning or connectivity. Configure both keys to use your Toggly application.

`TOGGLY_APP_KEY` is a backend App Key read only by `hooks.server.ts`. `PUBLIC_TOGGLY_APP_KEY` is a Front-end App Key intentionally delivered to the browser through SvelteKit's public environment system. Both environment variables default to Production. This adapter-node sample uses dynamic environment imports at runtime. No keys are required for the offline tests/build. Never put a backend key in a `PUBLIC_` variable.

## Configure Toggly

Follow [APP_SETUP](../docs/APP_SETUP.md) and the shared [FLAG_TEMPLATE](../docs/FLAG_TEMPLATE.md). Name the application **SvelteKit SDK Sample**, select **NodeJS** (`nodejs`) for the backend evaluation client, and select **Production**. SvelteKit is the application framework; the dedicated adapter does not require a new technology picker label. In App Settings generate an additional **Front-end App Key**. Mark the intended browser flags **Available to Client SDK**. Allow the exact development origin `http://127.0.0.1:5173` (and `http://localhost:5173` only if you use it).

Create `new-dashboard`, `api-v2`, `enhanced-submit` and `beta-access` baseline flags. ON is AlwaysOn; OFF is an empty rule list. Create Order with Id as key and Vip boolean. Bind ExpressCheckout and filter-context-property to Order before adding the Vip=true condition. Create all eleven Filters-category flags from FLAG_TEMPLATE.

The backend local evaluator's parameter shape is explicit in `src/lib/catalog.ts`: `Audience.Users:0`, `Claim`/`Value`, `Country:0`, `BrowserFamily:0`, `BrowserLanguage:0`, `DeviceType:0`, `OperatingSystem:0`; every segment has Percentage=100. The standalone percentage rollout uses Value=50. This source fixture mirrors the shared flag contract; it does not provision your application.

## Your first toggle

1. Configure both keys and restart the development server. Visit **Declarative**.
2. Enable `new-dashboard` in Production and make it Available to Client SDK. After the signed refresh, expect **New dashboard enabled**.
3. Disable it. Expect **Classic dashboard — the fallback branch**; the programmatic result also becomes false.
4. Compare Home's frontend snapshot. The allowlist includes only the intended browser keys. Refresh the page to observe SSR and hydration selecting the same branch.
5. Empty keys keep the offline default for new-dashboard=true; dashboard changes cannot affect offline fixtures.

Definitions describe flag rules, and evaluation applies the current identity/request/entity to produce a result. Initialization loads those rules before server requests. Backend and frontend keys address the same application but expose different contracts: server rules versus evaluated frontend results. Environments isolate configurations; mismatched environments can produce different branches.

## Sections

| Section | What to inspect |
| --- | --- |
| Home | First toggle, source map and current allowlisted frontend snapshot |
| Declarative | Feature/fallback, negate and multi-key any; explicit variant support boundary |
| Programmatic | Synchronous single/all/any/default checks on a layout-owned store |
| Identity | Matching alice/admin and Non-matching bob/user; request isolation and navigation |
| Entity | ord-vip and ord-standard, server results and browser EntityGate results |
| Filters | Eleven server-evaluated filters with both shared presets |
| Framework | Hook/load/hydration lifecycle and guarded enhanced-submit action |
| Missing-key banner | Visible on every section when either required key is absent |

These are boolean branches. This SDK does not assign experiment variants; do not invent A/B assignments from on/off state. Browser local prerequisites are available through the SDK's `localGates` option and AND with remote values.

The filter presets use the exact Chrome/macOS and Firefox/Windows strings from FLAG_TEMPLATE. AlwaysOn and the open TimeWindow remain ON for both. Percentage is identity-sticky, so the preset name does not prescribe it. Other matrix flags match alice/admin/US/English/Chrome/Macintosh/Mac/Vip and reject the opposite preset. Browser segment filters use actual browser headers after hydration; the server matrix remains the explicit controlled demonstration.

## Source-reading map

| File | Why it matters |
| --- | --- |
| `.env.example` | Public versus private keys, environment and offline fallback |
| `src/lib/catalog.ts` | Exact flags, native filter parameter names, identity presets, mapped Order entities |
| `src/hooks.server.ts` | Initializes Node core, supplies one context per request, projects public targeting and closes at shutdown |
| `src/routes/+layout.server.ts` | Uses loadToggly, computes request-bound server results and tracks preset navigation |
| `src/routes/+layout.svelte` | Synchronous hydration, layout context ownership, browser mount and disposal |
| `src/routes/[[section]]/+page.svelte` | Actual Feature, negate, all/any/default and entity callsites |
| `src/routes/[[section]]/+page.server.ts` | Rechecks enhanced-submit before an action |
| `tests/catalog.test.ts` | Runs every matching/nonmatching filter through the actual Node evaluator |
| `tests/browser/showcase.spec.ts` | Adapter-node SSR, hydration, context navigation, concurrency and action smoke |

## Failure and security boundaries

No App Key means explicit offline defaults. Server filter fixtures are used only with no backend key. Frontend defaults omit ExpressCheckout; until a live entity gate arrives, its browser result is false. A missing entity fails closed. A server request that cannot fetch a verified frontend snapshot uses exposed defaults. A browser failed refresh preserves its matching SSR or last verified in-memory snapshot. Parsed persistent browser caches are never trusted. The browser polls every three minutes and receives WebSocket updates; layout destruction disposes its resources.

`createTogglyHandle` copies context once and passes it to Node evaluation. It never mutates the shared client's user identity. Demo claims are not authentication. Production context should come from your authenticated session, and only explicitly public targeting attributes should go through `clientContext`. Frontend gates do not replace server authentication/authorization; actions enforce their feature gate again.

Only adapter-node is demonstrated. Static prerender is a build-time snapshot; it cannot provide per-user server hooks or actions. No edge-adapter behavior is claimed.

## Verify

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Manual checklist: visit every section; switch both identity/filter presets; compare VIP/standard orders; verify both dashboard branches with real keys; turn enhanced-submit off and confirm the action returns404; navigate repeatedly and inspect socket cleanup; stop network access after a verified refresh and observe the matching in-memory fallback; clear keys and confirm the banner. These checks do not provision or validate your real dashboard setup.

See the [SvelteKit guide](https://docs.toggly.io/sdks/javascript/sveltekit) for the full API and [Node SDK](https://docs.toggly.io/sdks/nodejs) for backend telemetry/cache configuration.
