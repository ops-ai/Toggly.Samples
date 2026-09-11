# Node Express SDK Sample

Eight navigable sections backed by the actual published Express adapter and Node core. Requires Node 22+. Latest stable registry versions checked 2026-09-08: Express **5.2.1**, `@ops-ai/toggly-express` **0.2.0**, `@ops-ai/toggly-node-core` **0.7.0** (exact pins + lockfile).

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

## First toggle: follow one flag from definition to response

A feature flag is a named decision your application checks at runtime. The key
`new-dashboard` identifies a rule in a Toggly application/environment; the SDK
fetches definitions and evaluates them with the current request's inputs. An ON
result chooses the new branch, and OFF chooses the existing branch. The keys in
`src/catalog.js` are a checklist, not enabled defaults. This sample supplies no
`featureDefaults`, so an unknown key or a missing-key startup evaluates OFF.

1. Start `npm run offline`, then open `/declarative`. The banner must say **Offline
   fixture** and the heading must say **Dashboard v2 variant**. This uses the real
   installed SDK with local definitions; no Toggly account is needed.
2. Open `/gates/enabled` and `/gates/negate`: both return 200. Dashboard is ON,
   while api-v2 is OFF, so its negated gate allows the legacy route. `/gates/all`
   returns 404 because both keys are required; `/gates/any` returns 200 because
   dashboard alone satisfies the gate.
3. In `src/fixture.js`, remove **only** `'new-dashboard'` from the first AlwaysOn
   list and add `rule('new-dashboard', 'AlwaysOff'),` as another array entry.
   Stop and restart `npm run offline`, then reload `/declarative`. You should see
   **Classic dashboard variant**; `/gates/enabled` and `/gates/any` now return 404.
   This changes a definition, not the page's branching code. Undo that exercise
   edit and restart before running the baseline tests.
4. Open `/filters?preset=matching`, then `/filters?preset=non-matching`. Eight
   filter rows change with the template inputs. AlwaysOn and the open TimeWindow
   remain ON. Percentage is stable for a given key/identity; do not expect every
   refresh to flip it or these two identities to demonstrate exactly 50% ON.
5. Open `/api/override?identity=bob`: `ambientBefore` and `ambientAfter` are false,
   but `override` is true. Only one call checks alice. Then compare `/entity` with
   `?order=ord-vip` and `?order=ord-standard`: the Order entity changes the checkout
   decision without changing who the user is.

For a live toggle, provision the application below, start `npm run dev`, and
change `new-dashboard` in the selected environment. Allow the three-minute
polling interval and reload, or restart and request the page to fetch again.
Check the source banner: a cached ON result after a refresh failure is not proof
that the latest live change arrived. A flag controls rollout; neither a flag
result nor a demo role grants authorization to protected data.

## Read the source in this order

| File | What to follow |
|---|---|
| [`src/catalog.js`](src/catalog.js) | Exact flag keys, reproducible request presets, typed Order attributes, and input precedence |
| [`src/server.js`](src/server.js) | Explicit offline selection, environment configuration, loopback listener, and shutdown of the shared client |
| [`src/app.js`](src/app.js) | Middleware before gates, lazy initialization, request context, provenance, core entity/override calls, and Express helpers |
| [`src/fixture.js`](src/fixture.js) | Actual definition payloads served over HTTP; compare with [the shared template](../docs/FLAG_TEMPLATE.md) |
| [`src/view.js`](src/view.js) | Rendering already-evaluated booleans and preserving demo inputs between pages |
| [`test/http.test.js`](test/http.test.js) | Existing executable expectations, concurrent isolation, definition changes, and failure cases |

The adapter shares one client and its downloaded definitions within the process.
Its middleware creates `req.toggly.context` for each request and binds the helper
methods to that context. This sample never calls a global identity setter for a
request. Identity, role and Order inputs travel through query fields/headers;
they are not persisted by a login session. Anonymous requests share the literal
`anonymous` identity. Replace the demo input extractors with trusted session data
in a real application, and keep authorization checks independent.

`kind: 'Order'` must match the definition's context kind. Its `key` identifies the
Order and `attributes.Vip` supplies the boolean used by ContextProperty; `Total`
is included as typed sample data but is not used by the current VIP rules.
The preset device value `Macintosh` is the installed evaluator's device-family
match, not a generic `desktop` label. Custom request mode uses actual HTTP
headers; selecting a preset deliberately overrides segment fields for repeatability.

## Provision the live application (pending)

Browser access to app.toggly.io required sign-in during implementation. No app or flags were provisioned and no live-key verification is claimed.

1. Sign into [Toggly](https://app.toggly.io), use a workspace you can manage (the one from signup is enough). Create **Node Express SDK Sample**, choose the matching Express/Node technology and **Production** environment. Allow `http://localhost:3000`.
2. Create context kind **Order**: `Id` string/key, `Vip` boolean, `Total` number.
3. Follow [FLAG_TEMPLATE.md](../docs/FLAG_TEMPLATE.md) exactly for the five baseline flags and eleven flags in the **Filters** category. `ExpressCheckout` and `filter-context-property` use `Order.Vip = true`.
4. For segment/claims filters set rollout Percentage to **100%** (the published evaluator requires it); the dedicated `filter-percentage` flag remains **50%**. Targeting users: alice. Claim role=admin. Country US. Browser Chrome. Language en. Device Macintosh. OS Mac. Time window 2020-01-01 through 2099-12-31.
5. Put the app key in ignored `.env.local` as `TOGGLY_APP_KEY`; keep `TOGGLY_ENVIRONMENT=Production`. Restart with `npm run dev`. Never commit the key.
6. Confirm **Live definitions — signature verified** before treating results as live. Failed startup displays **Unavailable**. Failed later refresh displays **Cached**, preserving last-known-good definitions in memory. No persistent cache provider is configured; restarting does not preserve that in-memory cache. Live polling runs every three minutes; streaming is disabled for this focused sample. Schema registration is manual and automatic startup registration is disabled.

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

Express 0.2.0 binds ambient context to `req.toggly.isFeatureOn`, `isFeatureOff`, and `evaluateFeatureGate`; their installed signatures **do not accept per-call overrides or entities**. This sample calls `req.toggly.client.isFeatureOn(key, context, entity)` from core 0.7.0 for those operations, preserving ambient context with an explicit spread for overrides. No request changes global identity. The adapter owns a process singleton: run one configured app per process, and call `closeExpressToggly()` on shutdown; tests close between app instances.

`featuresHandler()` returns a global SDK boolean snapshot alongside the **request identity**; that snapshot does not represent request claims/entities. Use `/api/evaluate` for request-evaluated results and provenance. Boolean content branches demonstrate variants; these packages expose no experiment-assignment API. All eleven template filters are supported by the installed core evaluator. AlwaysOn/open TimeWindow remain on in both presets; Percentage is identity-sticky and has no prescribed matching outcome.

## Manual live checklist — all pending

- [ ] Provision app/context/flags and confirm signature-verified live banner.
- [ ] Toggle new-dashboard and api-v2; observe HTML variant, enabled/negate/all/any routes (disabled 404).
- [ ] Disable beta-access; `/gates/beta` redirects to declarative. Disable api-v2; `/unique/route` returns custom 403.
- [ ] Toggle enhanced-submit; `/unique/wrapped` executes or returns 404.
- [ ] Apply Matching/Non-matching on filters; verify the eight prescribed rows, AlwaysOn/TimeWindow and sticky percentage.
- [ ] Switch Order; verify ExpressCheckout and context-property behavior.
- [ ] Use alice/bob identities and role controls; override endpoint leaves ambient results unchanged.
- [ ] Compare global featuresHandler snapshot with request evaluation.
- [ ] Remove key/restart; visible missing-key banner, no crash and no network.
- [ ] Interrupt live connectivity after successful fetch; next polling failure labels Cached. With unavailable service at fresh startup, label Unavailable.

Offline HTTP tests cover rendered section/navigation output, real gates, both filter presets, 30 concurrent identities/claims/headers/entities, override isolation, sticky percentage, startup/refresh failures and missing/placeholder configuration. They do not prove hosted app configuration or signed live transport.
