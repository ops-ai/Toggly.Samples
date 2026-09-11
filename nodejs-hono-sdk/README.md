# Node Hono SDK Sample

Eight navigable sections backed by the actual published Hono adapter and Node core. Requires Node 22+. Latest stable registry versions checked 2026-09-08: Hono **4.13.7**, `@hono/node-server` **2.1.1**, `@ops-ai/toggly-hono` **0.3.0**, `@ops-ai/toggly-node-core` **0.7.0** (exact pins + lockfile).

```sh
npm ci
cp .env.example .env.local
npm run dev
# http://localhost:3000
```

The dev/start commands load `.env` then `.env.local` (the latter wins); both remain ignored. An empty key displays a configuration banner and starts without contacting Toggly. For a deterministic demonstration without credentials:

```sh
npm run offline
```

Offline mode starts a loopback definitions HTTP fixture. The unmodified published SDK fetches those definitions and evaluates all rules; no replacement evaluator or local SDK tarball is used. Every page and evaluated JSON response labels the fixture, including cached/unavailable failures. The common `X-Toggly-Source` response header also labels adapter-owned snapshots, gate denials and redirects. Fixture baseline: dashboard, enhanced-submit and beta enabled, api-v2 disabled. `npm test` starts its own ephemeral HTTP listeners; `npm run build` syntax-checks all runnable JavaScript (there is no compilation/bundle step).

## Your first toggle: observe a request changing its result

A feature flag is a named decision in your application. The code asks whether a key is on; its definition decides the answer. An environment selects the definitions to fetch. Request identity, claims and an optional entity supply inputs to those rules. A definition can therefore stay unchanged while two requests receive different results.

1. Start `npm run offline`, open `/entity?preset=non-matching`, and find **Standard checkout**. This preset selects `ord-standard`, whose `Vip` attribute is false.
2. Select **Matching**, then **Apply preset**. You should see **Express checkout available**: the `ExpressCheckout` definition checks the selected Order's `Vip` attribute. This changes evaluation inputs, not a remote dashboard setting.
3. Open `/api/evaluate?preset=matching`. Find the separate `context` and `order` inputs and `flags.ExpressCheckout: true`. Compare `/api/evaluate?preset=non-matching`, where that flag is false. The banner and `source` must still say **Offline fixture**.
4. Open `/declarative`, then follow the enabled, negate, all and any gates. The fixture has `new-dashboard` on and `api-v2` off: enabled/negate/any return 200, while all returns 404. `negate` inverts the result; it does not enable the underlying flag.
5. Open `/api/override?identity=bob`: `ambientBefore` and `ambientAfter` are false, while the one-call alice override is true. The shared client's identity was not changed.

To change an actual dashboard toggle, complete the pending live provisioning below, restart in configured mode and wait for **Live definitions — signature verified**. Switch `new-dashboard` off in the selected environment, wait for the next three-minute poll, then reload `/declarative`: the classic variant replaces dashboard v2 and `/gates/enabled` returns 404. That live exercise remains pending; the offline steps establish local SDK behavior only.

Without a key, no definitions are fetched. This sample supplies no `featureDefaults`, so missing keys evaluate false. This differs from an explicit disabled definition and from a failed refresh with cached definitions: cached rules can still evaluate true. Negated gates can allow a request when the underlying flag is false, including in defaults-only mode.

## Read the source in this order

| File | What to follow |
|---|---|
| [`src/catalog.js`](src/catalog.js) | Five baseline keys, eleven filter keys, controlled presets and ready Order entities; query/preset/header precedence |
| [`src/fixture.js`](src/fixture.js) | Definition data and a loopback HTTP server; the installed SDK, not this file, evaluates rules |
| [`src/app.js`](src/app.js) | Initialization, request context, provenance, core entity/override calls, and middleware/handler gates |
| [`src/view.js`](src/view.js) | Escaped controls and presentation of booleans already evaluated for this request |
| [`src/server.js`](src/server.js) | Environment configuration, listener, and cleanup of the shared adapter client |
| [`test/http.test.js`](test/http.test.js) | Expected HTTP outcomes, concurrent request isolation, definition changes and cache/failure evidence |

Trace `ExpressCheckout` from the catalog, through its fixture `ContextProperty` definition, to `evaluate` in `app.js` and the entity page in `view.js`. Then compare an ambient helper call with the explicit core call in `/api/override`. Neither helper nor route gate authenticates a caller.

### Configuration while learning

`.env.example` documents the server variables; `TOGGLY_APP_KEY` selects the app and `TOGGLY_ENVIRONMENT` selects its environment. `PORT` controls the local listener only. They are read on server startup, so edits require a restart. No browser build prefix such as `VITE_` or `NEXT_PUBLIC_` is involved. The offline command does not load the `.env` files; it supplies its own loopback endpoint and disables signature verification only for that fixture. Do not copy that unsigned configuration into live mode.

## Provision the live application (pending)

Browser access to app.toggly.io required sign-in during implementation. No app or flags were provisioned and no live-key verification is claimed.

1. Sign into [Toggly](https://app.toggly.io), use a workspace you can manage (the one from signup is enough). Create **Node Hono SDK Sample**, choose the matching Hono/Node technology and **Production** environment. Allow `http://localhost:3000`.
2. Create context kind **Order**: `Id` string/key, `Vip` boolean, `Total` number.
3. Follow [FLAG_TEMPLATE.md](../docs/FLAG_TEMPLATE.md) exactly for the five baseline flags and eleven flags in the **Filters** category. `ExpressCheckout` and `filter-context-property` use `Order.Vip = true`.
4. For segment/claims filters set rollout Percentage to **100%** (the published evaluator requires it); the dedicated `filter-percentage` flag remains **50%**. Targeting users: alice. Claim role=admin. Country US. Browser Chrome. Language en. Device Macintosh. OS Mac. Time window 2020-01-01 through 2099-12-31.
5. Put the app key in ignored `.env.local` as `TOGGLY_APP_KEY`; keep `TOGGLY_ENVIRONMENT=Production`. Restart with `npm run dev`. Never commit the key.
6. Confirm **Live definitions — signature verified** before treating results as live. Failed startup displays **Unavailable**. Failed later refresh displays **Cached**, preserving last-known-good definitions. Live polling runs every three minutes; streaming is disabled for this focused sample. Schema registration is manual and automatic startup registration is disabled.

## Section map (Next.js contract parity)

| Section | Route | Behavior |
|---|---|---|
| Home | `/home` or `/` | Navigation, all sixteen flag checklist/results |
| Declarative gates | `/declarative` | Boolean content variants, feature/negate/all/any/beta HTTP gates |
| Programmatic API | `/programmatic` | `/api/evaluate` request results; `/api/override` one-call identity override |
| Identity | `/identity` | Request identity, claims and HTTP context; editable controls |
| Entity context | `/entity` | VIP and standard Order checkout branches |
| Filters matrix | `/filters` | All eleven matching/non-matching filter rows |
| Package unique | `/unique` | Real featureRoutes, withFeature, featuresHandler |
| Configuration | `/configuration` | Missing-key banner and setup/failure explanation |

Preset forms and navigation preserve selected query inputs. Custom request inputs use query fields `identity`, `role`, `order`; HTTP callers may instead send `x-toggly-identity`, `x-demo-role`, `x-demo-order`, `cf-ipcountry`, `accept-language`, and `user-agent`. With no preset, the adapter's `fromHttpRequest` fills HTTP segment context from headers. Presets explicitly override those fields with the exact shared template values. These are local demo inputs, **not authentication**; never deploy trusting user-supplied roles or country headers.

```sh
curl 'http://localhost:3000/api/evaluate?preset=matching'
curl 'http://localhost:3000/api/evaluate?preset=non-matching'
curl 'http://localhost:3000/api/override?identity=bob'
curl -i 'http://localhost:3000/gates/all'
```

## Published capability boundaries

Hono adapter 0.3.0 binds ambient context to `c.get('toggly').isFeatureOn`, `isFeatureOff`, and `evaluateFeatureGate`; their installed signatures **do not accept per-call overrides or entities**. This sample calls `c.get('toggly').client.isFeatureOn(key, context, entity)` from core 0.7.0 for those operations, preserving ambient context with an explicit spread for overrides. No request changes global identity. The adapter owns a process singleton: run one configured app per process, and call `closeHonoToggly()` on shutdown; tests close between app instances.

`featuresHandler` is a handler value, registered as `app.get('/api/features', featuresHandler)`, not called as a factory. It returns the shared SDK boolean snapshot alongside the **current request identity**. Those flags were not evaluated for that identity or its request claims/entities; the response identity does not make the snapshot user-specific. Use `/api/evaluate` for request-evaluated results and provenance. Boolean content branches demonstrate variants; these packages expose no experiment-assignment API. All eleven template filters are supported by the installed core evaluator. AlwaysOn/open TimeWindow remain on in both presets; Percentage is identity-sticky and has no prescribed matching outcome.

## Manual live checklist — all pending

- [ ] Provision app/context/flags and confirm signature-verified live banner.
- [ ] Toggle new-dashboard and api-v2; observe HTML variant, enabled/negate/all/any routes (disabled 404).
- [ ] Disable beta-access; `/gates/beta` redirects to declarative. Disable api-v2; `/unique/route` returns custom 403.
- [ ] Toggle enhanced-submit; `/unique/wrapped` executes or returns 404.
- [ ] Apply Matching/Non-matching on filters; verify the eight prescribed preset-dependent rows, AlwaysOn/TimeWindow and sticky percentage.
- [ ] Switch Order; verify ExpressCheckout and context-property behavior.
- [ ] Use alice/bob identities and role controls; override endpoint leaves ambient results unchanged.
- [ ] Compare global featuresHandler snapshot with request evaluation.
- [ ] Remove key/restart; visible missing-key banner, no crash and no network.
- [ ] Interrupt live connectivity after successful fetch; next polling failure labels Cached. With unavailable service at fresh startup, label Unavailable.

Native Hono `app.request` tests plus an actual Node listener/fetch smoke cover rendered section/navigation output, real gates, both filter presets, 30 concurrent identities/claims/headers/entities across asynchronous context extraction, override isolation, sticky percentage, startup/refresh failures and missing/placeholder configuration. They do not prove hosted app configuration or signed live transport.

The installed Hono 0.3.0 runtime and types accept only a key on `isFeatureOn`/`isFeatureOff`: extra arguments are ignored. The core-client override shown here follows the installed artifact. `featuresHandler` is a handler value, not a factory. `featureRoutes` supports method filtering; GET `/unique/route` is gated while POST demonstrates the explicit GET-only policy. `getHonoToggly()` exposes the singleton for lifecycle diagnostics/tests, never request identity mutation.

See the [Hono SDK guide](https://docs.toggly.io/sdks/nodejs/hono) for adapter configuration and the [Samples catalog](../README.md) for other frameworks and their availability.
