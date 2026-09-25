# Nuxt SDK Sample

A Nuxt **4.5.2** application that teaches Toggly feature flags across the published Nuxt family:

| Package | Version | Responsibility |
|---|---:|---|
| `@ops-ai/nuxt-toggly` | `1.4.0` | Nuxt module: auto-imports, Vue components/directives, browser plugin and Nitro plugin |
| `@ops-ai/nuxt-toggly-core` | `1.13.0` | Definition fetching and feature evaluation |
| `@ops-ai/nuxt-toggly-client` | `1.3.0` | Vue composables, components, directives and browser telemetry |
| `@ops-ai/nuxt-toggly-server` | `1.7.0` | Request-scoped H3/Nitro helpers and route gates |

All four are exact public npm packages. This sample uses no SDK workspace path,
tarball, or substitute evaluator. Node 22.19+ is required by this sample.

```sh
npm ci
cp .env.example .env
npm run dev
# open http://localhost:3000
```

With the blank example key, the page deliberately displays a **Missing Toggly
application key** banner and all safe defaults are off. It does not crash or
make a definition request. Nuxt CLI loads the project-root `.env` file for
`npm run dev` and `npm run build`; put your own key in ignored `.env`, restart,
and use the same local URL. This is a Nuxt application, so the environment
variable is `TOGGLY_APP_KEY` — not a Vite-prefixed variable.

## First toggle: follow one decision end to end

A feature flag is a named runtime decision. A definition for
`new-dashboard` belongs to one Toggly app/environment. The SDK evaluates it
with the current request or browser context, then the application chooses the
new or established branch. A flag is not authentication or authorization.

1. Complete the Toggly app recipe below, then put its application key in `.env`.
2. Start the app and open the **Home** section. Its snapshot says `live` once
   the SDK has a configured key; it says `defaults` with no key.
3. Turn `new-dashboard` on in your app's Production environment and refresh.
   In **Declarative gates**, the `<Feature>` enabled branch becomes visible.
4. Turn it off again. The `<Feature negate>` branch shows the established
   dashboard. No page code changes: the definition controls the decision.
5. Open **Filters** and compare Matching with Non-matching. They use the
   exact shared identities, claims, HTTP fields and Order values from the
   template, while percentage remains stable for an identity rather than
   promising a particular result.

## Read the source in this order

| File | What it teaches |
|---|---|
| [`nuxt.config.ts`](nuxt.config.ts) | The module configuration, app-key environment variable, safe defaults, SSR and cache choice |
| [`lib/toggly-options.ts`](lib/toggly-options.ts) | The explicit hand-off from Nuxt-loaded `.env` values to module initialization options |
| [`lib/demo.ts`](lib/demo.ts) | Shared flag names, all eleven filter rows, and canonical `Order` entity shape |
| [`server/plugins/toggly-context.ts`](server/plugins/toggly-context.ts) | Per-H3-event identity/claims/request extraction without a global user identity |
| [`server/utils/toggly-server.ts`](server/utils/toggly-server.ts) | Idempotent Nuxt 4 dev-safe server initialization before the first request helper |
| [`server/api/snapshot.get.ts`](server/api/snapshot.get.ts) | Server evaluation, multi-key gate, and Order-aware ContextProperty checks |
| [`app/components/ClientGates.vue`](app/components/ClientGates.vue) | Vue declarative gates, composables, browser-session identity and entity checks |
| [`server/api/beta.get.ts`](server/api/beta.get.ts) | Nuxt `defineFeatureHandler` wrapping a Nitro API route |
| [`tests/`](tests/) | Executable contract checks plus a disposable `.env` `nuxt dev` startup and `/api/snapshot` regression test |

The Nuxt module initializes the browser SDK from public module configuration so
the browser can fetch public definitions. The Toggly application key identifies
the app; it is not an end-user secret. Keep it local so the sample does not
publish an app association. Never put a user token or another private credential
in Nuxt public runtime configuration. The local tutorial disables optional
server usage/metrics telemetry through the module's server-specific options.
The browser module keeps usage and business metrics enabled with a key. Set
`TOGGLY_ENABLE_TELEMETRY=false` in local `.env` to opt out of browser reporting.
`TOGGLY_METRICS_BASE_URL` can direct an isolated test to an intercepting endpoint;
the default is the public metrics endpoint. The demo telemetry button records
usage, view, counter and gauge through the module-created browser client and
flushes the queue. Use metric keys approved for your application when adapting it.
Nuxt 4's Vite configuration prebundles the published CommonJS hooks and
evaluator dependencies used by Core's browser ESM build. This keeps the public
package graph working in the browser without a local SDK source alias.

## Create the Toggly application

No dashboard API or connected Toggly workspace tool is available to this build,
so this app needs to be created manually:

1. Sign in at [app.toggly.io](https://app.toggly.io). Use a workspace you can manage (the one from signup is enough). Create **Nuxt SDK Sample** using the Nuxt technology picker. Select the **Production** environment.
2. Add `http://localhost:3000` under **Allowed Web Origins**.
3. Create context kind **Order** with `Id` as the string key, `Vip` as boolean,
   and `Total` as number. `Total` is optional in demo data. Bind
   `ExpressCheckout` and `filter-context-property` to Order before adding their
   `Order.Vip = true` ContextProperty conditions.
4. Add the five baseline flags and the eleven filter flags from the shared
   [flag template](../docs/FLAG_TEMPLATE.md). Use the specified 100% segment
   rollout for restrictive filters and 50% only for `filter-percentage`.
5. Copy `.env.example` to ignored `.env`, set your `TOGGLY_APP_KEY`, keep
   `TOGGLY_ENVIRONMENT=Production`, and restart `npm run dev`. Do not commit the key.

With no `demo-identity` browser cookie, Matching defaults to alice and
Non-matching defaults to bob. Both presets retain their own role, country,
language, browser, OS, and Order values, but both derive **identity** from that
cookie once the browser session sets it. The demo supplies these values solely
to make the learning exercise repeatable. Replace them with trusted session
data and request data in a real application. Do not trust a user-controlled
role, country, or query parameter.

## Section map

| Contract section | Where | Native Nuxt surface |
|---|---|---|
| Home | `/` → Home | Flag checklist and server-evaluated snapshot |
| Declarative gates | `/` → Declarative gates | `<Feature>`, `negate`, `useFeatureFlag`, `useFeatureOff`, `useFeatureGate`, `v-feature` |
| Programmatic API | `/` → Programmatic API | `useToggly().isFeatureOn()`, explicit browser telemetry and Nitro `isEventFeatureOn()` |
| Identity | `/` → Identity | Browser session identity plus `configureEventEvalContext` on each H3 event |
| Entity context | `/` → Entity context | `Order` canonical context passed to `isFeatureOn()` / `<Feature>` |
| Filters matrix | `/` → Filters matrix | Matching/Non-matching request and Order presets for all eleven template filters |
| Package-unique surface | [`/api/beta`](server/api/beta.get.ts) | `defineFeatureHandler('beta-access')` around a Nitro handler |
| Missing app key | `/` → Configuration | Banner plus safe-off defaults, without initialization crash |

### Capability boundary: variants

`@ops-ai/nuxt-toggly` **1.4.0** exposes boolean feature gates. It does not
currently expose an experiment/variant-assignment API, so the declarative
section calls this out instead of fabricating a variant result. All eleven
shared filter types are evaluated by the published Nuxt core/server packages;
`filter-percentage` remains intentionally nondeterministic across identities
but sticky for a given identity.

## Why identity and Order context are separate

Identity answers “which user/session is this?” and supports targeting and
percentage rollouts. The server plugin provides functions that resolve that
answer on the current H3 event. It does **not** call `setIdentity` on a
long-lived process client. The browser's `setIdentity` only changes that
browser's SDK session.

Order answers “which domain object is this decision about?” It is passed to a
single check as `{ kind: 'Order', key, attributes }`. Here `key` represents
`Order.Id` and `attributes.Vip` represents `Order.Vip`. If the entity is absent
or its kind is not registered in your Toggly app, the context-aware decision
fails closed. Do not put Order fields into identity.

## Verification

```sh
TOGGLY_APP_KEY=ci-placeholder TOGGLY_ENVIRONMENT=Production npm ci
TOGGLY_APP_KEY=ci-placeholder TOGGLY_ENVIRONMENT=Production npm test
TOGGLY_APP_KEY=ci-placeholder TOGGLY_ENVIRONMENT=Production npm run build
```

CI runs these commands with a placeholder only. They verify installation,
unit-level shared contract data, and the Nuxt production build. They do not
prove a live dashboard configuration, a real app key, or a particular
percentage result.

## Manual live checklist

- [ ] Create the app, Order schema, flags, and allowed origin above; add a real key only to `.env`.
- [ ] Toggle `new-dashboard`; confirm both `<Feature>` and `<Feature negate>` branches switch after refresh.
- [ ] Toggle `api-v2`; compare the multi-key `all` and `any` gate results.
- [ ] Toggle `enhanced-submit`; use the programmatic button and observe its boolean result.
- [ ] Change the browser identity; reload Matching and Non-matching and confirm both Nitro snapshots receive that cookie-scoped session identity while their other preset fields stay distinct.
- [ ] Compare `ord-vip` and `ord-standard`; confirm `ExpressCheckout` and `filter-context-property` follow `Vip`.
- [ ] Compare Matching and Non-matching filter presets. Confirm AlwaysOn and the open TimeWindow remain on; record rather than assume the percentage outcome.
- [ ] Toggle `beta-access`; open `/api/beta` and confirm `defineFeatureHandler` allows or denies the handler.
- [ ] Remove `TOGGLY_APP_KEY`, restart, and confirm the missing-key banner and safe-off values appear without a crash.
