# NestJS SDK Sample

Eight pages show the same feature decisions through NestJS HTTP guards, request-scoped services, JSON and HTML. Requirements: Node **22+**; npm. Packages: `@ops-ai/toggly-nestjs` **0.1.0**, NestJS **11.2.3**, reflect-metadata **0.2.2**, RxJS **7.8.2**. The adapter requires Node core **^0.9.1**. Direct dependencies are pinned registry references. No SDK source imports, copies or file dependencies are used; npm generates a local lockfile on installation.

## Quick start

```sh
cd nestjs-sdk
npm install
npm run offline
# Open http://localhost:3000
```

Offline mode serves definition documents on loopback and evaluates them with the installed package. Its banner always says Offline fixture; it does not prove dashboard provisioning, signatures or live connectivity.

For live mode:

```sh
cp .env.example .env.local
# Set your own TOGGLY_APP_KEY after provisioning below.
npm run build
npm start
```

`.env` then `.env.local` load at process startup; `.env.local` wins. `TOGGLY_APP_KEY` is server-only and never embedded in HTML. It selects an application and does not authorize the management API. `TOGGLY_ENVIRONMENT` defaults to Production, `PORT` to 3000. There is no public prefix or build-time substitution. Restart after changes. Blank keys or CI-only `ci-placeholder` select defaults without network; missing flags default false.

## First toggle exercise

1. Run offline mode. Home shows new-dashboard ON and api-v2 OFF.
2. Open Declarative: Dashboard v2 appears; Enabled and Any return 200; All returns 404; Negate allows the legacy API.
3. Provision live mode, then disable new-dashboard in Toggly. Wait for streaming/poll refresh and reload: classic dashboard appears and Enabled returns 404. Re-enable to restore. Editing offline fixtures only changes local rules after restart.
4. Apply Matching then Non-matching on Filters. Targeting/claims/request/entity rows change; AlwaysOn and the open TimeWindow stay ON. Percentage is sticky, with no guarantee alice and bob differ.

A **key** is an exact case-sensitive identifier. A **definition** supplies rules for an **environment**. **Evaluation** runs locally with request context, without fetching once per flag. **Initialization** finishes before Nest serves requests, including fallback; completion alone does not prove a successful fetch.

## Provision application and flags

Create **NestJS SDK Sample**, environment **Production**, URL **http://localhost:3000**, technology **Node.js** using the [application setup guide](../docs/APP_SETUP.md). This server-only app needs no browser CORS origin. Follow the [shared flag template](../docs/FLAG_TEMPLATE.md) and its UI/API instructions. No application is pre-provisioned here.

Create **Order** with `Id` string/key, `Vip` boolean, `Total` number. Bind ExpressCheckout and filter-context-property to Order in their Context field. Configure Vip equals true and remove extra AlwaysOn conditions.

| Key                                                         | Rule                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| `new-dashboard`, `api-v2`, `enhanced-submit`, `beta-access` | Baseline toggle: enabled AlwaysOn; disabled no rules         |
| `ExpressCheckout`                                           | ContextProperty Order.Vip equals true                        |
| `filter-always-on`                                          | AlwaysOn                                                     |
| `filter-percentage`                                         | Percentage Value 50                                          |
| `filter-targeting`                                          | Targeting user alice; no default/group rollout               |
| `filter-user-claims`                                        | UserClaims role = admin, Percentage 100                      |
| `filter-time-window`                                        | TimeWindow 2020-01-01T00:00:00Z through 2099-12-31T23:59:59Z |
| `filter-country`                                            | Country US, Percentage 100                                   |
| `filter-browser-family`                                     | BrowserFamily Chrome, Percentage 100                         |
| `filter-browser-language`                                   | BrowserLanguage en, Percentage 100                           |
| `filter-device-type`                                        | DeviceType Macintosh, Percentage 100                         |
| `filter-os`                                                 | OperatingSystem Mac, Percentage 100                          |
| `filter-context-property`                                   | ContextProperty Order.Vip equals true                        |

Native parameters are executable in [`src/fixture.js`](src/fixture.js): `Audience.Users:0`, segment arrays such as `Country:0`, and ContextProperty `{ Property: 'Vip', Operator: 'eq', Value: 'true', ValueType: 'boolean' }`. These are real rule documents, not precomputed answers. Tests exercise all eleven filters through the installed evaluator.

Matching: alice, groups staff, role admin, US, English, Chrome 120/macOS, ord-vip/Vip true. Non-matching: bob, no groups, role user, CA, French, Firefox 121/Windows, ord-standard/Vip false. Exact User-Agent strings are in [`src/catalog.js`](src/catalog.js), matching the shared template.

## Eight sections and source map

| Section       | Exercise                                             | Source                                   |
| ------------- | ---------------------------------------------------- | ---------------------------------------- |
| Home          | Flag checklist and request-evaluated snapshot        | app.ts evaluate/index; view.js home      |
| Declarative   | Feature, negate, all/any, boolean content variant    | app.ts gate handlers                     |
| Programmatic  | JSON evaluation and alice override                   | app.ts evaluated/override                |
| Identity      | Presets and custom identity/role                     | catalog.js inputs; app.ts contextFactory |
| Entity        | ord-vip / ord-standard checkout                      | catalog.js orders; app.ts evaluate       |
| Filters       | Matching/Non-matching matrix                         | fixture.js; view.js filters              |
| Unique        | FeatureEnabled parameter, readiness, shared snapshot | app.ts parameter/health/features         |
| Configuration | Visible missing-key banner                           | view.js; .env.example                    |

Read catalog.js for keys/context, app.ts for configuration and evaluation, then view.js for escaped HTML. main.ts owns the host. fixture.js owns only offline transport; test/app.test.ts exercises HTTP against the installed SDK.

## Request context and guard behavior

The context factory runs once on first evaluation. Query controls override demo headers. Custom mode reads User-Agent, Accept-Language and cf-ipcountry; presets explicitly replace these. Production must read authenticated principals and trusted proxy metadata: query claims and country headers are not authentication or location proof. No shared identity is mutated. `/api/override?preset=non-matching` yields bob false, alice true for one call, bob false afterward.

Canonical entities have `{ kind: 'Order', key, attributes: { Id, Vip, Total } }`; preserve boolean/numeric types and match the definition contextKind. Raw domain objects require a registered core mapper; this sample uses canonical entities directly. Guards are rollout decisions, not authorization. FeatureFlag pairs with FeatureFlagGuard; disabled is 404, beta explicitly uses 403. Thrown context/evaluation failures become 503; core refresh fallback still evaluates normally. Negation inverts the combined decision. Boolean UI variants are not experiment assignments.

FeatureEnabled injects an async evaluated boolean through a request-scoped pipe. `/api/features` is the shared initialization-identity snapshot; `/api/evaluate` is personalized. HTML and request JSON use no-store to avoid cross-user caching.

## Reliability and lifecycle

Live mode verifies signed definitions, enables streaming, and polls every three minutes. The sample caches definitions in memory only. Failed refresh retains last-known-good rules (Cached banner); failed first startup uses defaults (Unavailable). FileCacheProvider/custom durable snapshots are SDK options, not enabled here. Those server caches contain trusted parsed definition models: startup does not reverify an original signed envelope from cache. Keep durable storage under application control; downloaded-signature verification does not authenticate writable local model arrays. This backend adapter evaluates raw server rules locally and does not use browser evaluated-signed definitions. Health returns initialized and degraded separately; it is an explanatory endpoint, not a Terminus indicator.

The singleton provider awaits initialization and closes core with the app, flushing telemetry and releasing timers/socket. Live usage/metrics follow core defaults; fixtures disable both. Application metrics use provider.client.measure/incrementCounter/observe; request usage uses TogglyService.recordUsage/recordView. The sample sends no business metrics from GET routes. GraphQL, WebSocket gateways, jobs, response interceptors and Terminus integrations are outside this HTTP sample.

## Manual checklist and tests

```sh
npm test
npm run build
```

- Visit all eight sections and check the source banner.
- Exercise Enabled, All, Any and Negate with baseline flags both on and off.
- Compare all filter presets and Order checkout results.
- Send parallel alice/bob requests and inspect the one-call override.
- Start without a key: visible banner and denied gates without a crash.
- Provision a real application and confirm no state.error in live mode; offline tests do not establish this.
- Stop the process and check timers/socket release.

[Customer guide](https://docs.toggly.io/sdks/nestjs) · [Sample Contract](../docs/SAMPLE_CONTRACT.md)
