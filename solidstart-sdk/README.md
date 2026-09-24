# SolidStart SDK workshop

A complete SolidStart 2 application using `@ops-ai/solid-feature-flags-toggly` **0.3.0**, SolidJS 1.9.15+, and Node 24+. It renders signed public flags on the server, hydrates a native Solid provider, and independently guards a server endpoint with the shared Node evaluator.

## Quick start

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5173. Empty keys show both configuration banners and explicit demo defaults. No account credentials or fabricated keys are included. Run `npm run typecheck`, `npm test` and `npm run build`; start the production output with `npm start`. Export runtime variables into the production process environment; copying `.env` alone is not a production secret injection mechanism.

## Set up your applications

Follow [app setup](../docs/APP_SETUP.md) and the shared [flag template](../docs/FLAG_TEMPLATE.md). Create separate backend and frontend applications for **SolidStart SDK Sample**, environment **Production**. Use an available Node/server technology for backend evaluation and a browser technology for frontend evaluation; do not invent a dashboard technology label. Allow the frontend origin http://localhost:5173. Create the complete checklist from `src/catalog.ts` in the relevant applications. The frontend drives the UI; the backend independently evaluates `enhanced-submit` for the server endpoint.

Define the **Order** context with **Id** as its key and boolean **Vip**. Bind ExpressCheckout and filter-context-property to Order and add `Vip = true`. Configure targeting with alice / staff and UserClaims with role=admin. The sample passes context per request/evaluation; it does not register entity schemas automatically.

| Variable                  | Scope and effect                                                   |
| ------------------------- | ------------------------------------------------------------------ |
| `TOGGLY_BACKEND_APP_KEY`  | Private server runtime backend key; empty uses backend defaults    |
| `TOGGLY_ENVIRONMENT`      | Backend environment, defaults to Production                        |
| `TOGGLY_BASE_URL`         | Backend definitions/JWKS endpoint                                  |
| `VITE_TOGGLY_APP_KEY`     | Public frontend key, used for server snapshots and browser refresh |
| `VITE_TOGGLY_ENVIRONMENT` | Public frontend environment, defaults to Production                |
| `VITE_TOGGLY_BASE_URL`    | Public frontend evaluated-signed/JWKS endpoint                     |

Vite substitutes `VITE_` values into browser JavaScript at build time. Rebuild after changing them, and supply the same values to server runtime for consistent snapshot targeting. Never put the backend key, private session claims, or a management credential in a `VITE_` variable. The adapter rejects identical frontend/backend keys but cannot identify an arbitrary key's application type.

## First-toggle exercise

1. Enable `new-dashboard` in the frontend Production environment. Refresh the page or use Refresh. Expect **New dashboard**, an enabled accessor and the matching snapshot value.
2. Disable it. Expect **Classic dashboard** in the negated block after live invalidation or Refresh.
3. Enable `enhanced-submit` in the backend application. Run server action should report that the server branch ran. Disable it and repeat: expect **404** even if frontend presentation is enabled.
4. Toggle Device ready. It can narrow the frontend enhanced-submit decision, but does not change the backend result.
5. Remove the keys and restart. Both banners appear. new-dashboard/api-v2/AlwaysOn defaults are true; enhanced-submit defaults false and the server action returns 404. Remote targeting is not simulated offline.

Keys identify decisions; definitions belong to an application/environment. The backend initializes a shared signed definition cache and evaluates request context locally. The server fetches a separately signed frontend snapshot and exposes only the catalog keys. SolidStart serializes that result; the browser provider initializes from it and starts transport on mount. Missing flags are false. Initial failures use explicit defaults; later same-context browser failures preserve verified state and expose an error. The mounted browser opts into localStorage for signed envelopes and their verified public keys, partitioned by app/environment/targeting. A fresh browser client can restore the matching signed definitions without network access, subject to key pins, expiry and signature age. Storage retains identity-bearing keys. The server query still needs its host and returns allowlisted defaults when the definitions service is unavailable; the sample does not supply a service worker or promise offline HTML/assets/server actions. Clear this origin's storage after using the demo.

## Sections

| Section               | What to inspect                                                                        |
| --------------------- | -------------------------------------------------------------------------------------- |
| Home                  | Section map, complete catalog/defaults, live public snapshot and first-toggle exercise |
| Declarative gates     | Paired Feature/negate blocks, loading, all/any, and a lazy panel behind beta-access    |
| Programmatic API      | Reactive accessor, synchronous browser evaluate/refresh, and real guarded POST         |
| Identity              | Matching and Non-matching links trigger server queries with separate contexts          |
| Entity context        | VIP checkbox feeds an explicit Order context to each ExpressCheckout evaluation        |
| Filters matrix        | All shared filter keys show current results and explain input constraints              |
| SolidStart boundaries | Server-only imports, signed snapshot projection, local gates and disposal navigation   |
| Configuration         | Separate missing frontend/backend banners and environment explanations                 |

Matching uses alice, staff and role=admin; Non-matching uses bob, no groups and role=user. These are UI-selected teaching presets, **not authentication**. Replace them with a trusted session lookup before protecting real operations. Request handlers never mutate a shared client's identity. Browser query caching uses the preset argument; a real login/logout flow must invalidate principal-dependent query results.

The Programmatic API section includes explicit browser telemetry actions. With a frontend key, telemetry is enabled by default; set `VITE_TOGGLY_ENABLE_TELEMETRY=false` to opt out. `VITE_TOGGLY_METRICS_BASE_URL` optionally overrides the metrics endpoint independently of `VITE_TOGGLY_BASE_URL`. Usage and view are explicit and component rendering does not record a view. The provider owns one reporter across its gates and direct checks. Define the sample `orders` counter and `active-carts` gauge in Toggly before expecting server-side acceptance. Solid owner cleanup flushes best effort when leaving the route; route snapshot hydration keeps the existing client and queue. Server-side telemetry remains on its existing server client and transport.

The VIP checkbox is independent of the identity preset. AlwaysOn remains on. Configure Percentage 100/0 for deterministic exercises; a 50% rollout is sticky but neither identity guarantees a particular bucket. Configure current/expired time windows to test both outcomes. Country/device/browser/OS/language rows reflect actual request properties, not invented results from the preset buttons. Server snapshot requests forward User-Agent/Accept-Language but originate at the server, so IP-derived country rules can differ after browser refresh. Use real browsers/networks and the shared flag template to verify those cases. This SDK exposes boolean gates and entity predicates, not experiment variant assignment.

## Source-reading map

Start with `src/lib/flags.server.ts`: backend ownership, per-request context, explicit public projection and allowlist. `src/lib/flags.ts` is the framework server-query boundary. `src/routes/index.tsx` receives the snapshot and shows all eight exercises. `src/routes/api/submit.ts` independently checks the server gate. `src/catalog.ts` contains keys, defaults, targeting presets and the Order mapping. `src/app.tsx` supplies route Suspense; `entry-server.tsx` and `entry-client.tsx` use SolidStart's native serialization and hydration.

## Manual checklist

- Empty keys: both banners, predictable defaults, guarded action 404, no invented remote results.
- Configured keys: server-rendered HTML contains public allowlisted flags, never the backend key/full definitions.
- Flip frontend new-dashboard; gate, negate, accessor and snapshot agree after refresh/live invalidation.
- Navigate Alice/Bob presets; request identity does not leak across concurrent sessions.
- Verify backend enhanced-submit independently of frontend presentation; real authorization remains separate.
- Toggle Order.Vip; ExpressCheckout follows its configured predicate. Missing entity context fails closed.
- Inspect matrix rows with actual browser/header/network/time constraints.
- Simulate a failed or invalidly signed refresh; verified state remains and error status appears.
- Leave via the disposal link; polling/socket/fetch work stops. Return to create a new provider.
- Inspect production browser bundles for backend keys or Node imports.

Offline tests and local fixture builds do not prove live dashboard provisioning, public registry installation or hosted connectivity. See the [SolidStart guide](https://docs.toggly.io/sdks/javascript/solidstart) and [SolidJS API](https://docs.toggly.io/sdks/javascript/solid).

Signed SSR and later hydrated snapshots remain authoritative during offline refresh. Matching cached definitions restore only when the current context has defaults; navigating to a different context clears the previous user's state first.
