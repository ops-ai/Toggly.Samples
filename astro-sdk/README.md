# Toggly Astro SDK Sample

A beginner-friendly Astro application that shows how Toggly feature flags reach
server components, request middleware, Markdown page gates, and React / Vue /
Svelte islands. It uses the published
`@ops-ai/astro-feature-flags-toggly` package only.

With no App Key, documented `flagDefaults` keep the workshop runnable. Browser
and presentation gates are not authorization.

## Quick start

Use Node **22.23.2+** (Astro 7 engines allow `>=22.12.0`; this sample matches
the Samples CI Node pin) and npm **11**.

```sh
cd astro-sdk
cp .env.example .env
npm ci
npx playwright install chromium
npm test
npm run dev
```

Open **http://localhost:4321**. The missing App Key banner means safe defaults
are active. For live definitions, set `TOGGLY_APP_KEY` and
`TOGGLY_ENVIRONMENT=Production` in `.env`, then restart. Use a public Frontend
/ Client Side API key only — never a management API key.

Installed versions (pinned in `package.json` / lockfile):

| Package | Version |
| --- | --- |
| Astro | 7.3.2 |
| `@ops-ai/astro-feature-flags-toggly` | 1.15.0 |
| `@astrojs/node` | 11.1.5 |
| `@astrojs/react` / `vue` / `svelte` | 6.0.5 / 7.0.2 / 9.0.1 |
| React / Vue / Svelte | 19.2.4 / 3.5.42 / 5.57.0 |

`npm run build` produces the static SSG site (including
`toggly-page-features.json`). `npm run build:ssr` builds the Node adapter
server used by middleware and page-gate checks.

## Your first flag, in three minutes

1. Confirm the missing-key banner (no App Key) and that **Server dashboard
   enabled** is visible — `new-dashboard` defaults to ON.
2. In a live app, turn `new-dashboard` off and reload. The server ON path and
   React/Vue/Svelte island ON paths disappear; negate paths appear.
3. Leave `api-v2` off. The **any** multi-key gate still shows; the **all** gate
   does not. That is why requirement matters.
4. Open `/?preset=matching` then `/?preset=nonmatching`. Identity and
   UserClaims rows change; Order ContextProperty follows the preset Order.
5. Visit `/beta/`. With defaults it is served; with
   `TOGGLY_BETA_ACCESS_DEFAULT=false` (no App Key) middleware returns 404.

## Exact Toggly Samples app recipe

1. Sign in at [app.toggly.io](https://app.toggly.io). Use a workspace you can
   manage.
2. Create **Astro SDK Sample**. Technology: **Astro**. Environment:
   **Production**. Application URL / allowed origin:
   `http://localhost:4321`.
3. Add context kind **Order** with key property **Id** (string), **Vip**
   (boolean), and optional **Total** (number).
4. Create the shared demo flags and Filters category exactly as
   [`docs/FLAG_TEMPLATE.md`](../docs/FLAG_TEMPLATE.md).
5. Copy the public App Key into `.env` as `TOGGLY_APP_KEY`. Restart
   `npm run dev`.

Matching preset: identity `alice`, claim `role=admin`, Order `ord-vip` /
`Vip=true`. Non-matching: `bob`, `role=user`, `ord-standard` / `Vip=false`.
Country / language / User-Agent strings in the template are for dashboard
rules and edge enforcement — see API gaps below.

Optional: add a `preview` variant on `new-dashboard` with configuration such
as `{"density":"compact"}`. The Experiment assignment panel uses a separate
request-scoped client with `enableVariants: true`.

`TOGGLY_BETA_ACCESS_DEFAULT` is a sample-only SSR knob when no App Key is set
(`true` by default). Live definitions override it.

## Sections and source-reading map

| Section | What to learn | Read |
| --- | --- | --- |
| 1. Home | Map, checklist, request snapshot | `src/pages/index.astro` |
| 2. Declarative gates | Feature / negate / multi-key / FeatureClient | `index.astro`, SDK `components/Feature.astro` |
| 3. Programmatic API | getFlag, evaluateGate, getVariant | `index.astro` frontmatter |
| 4. Identity | Per-request identity/claims from URL | `src/middleware.ts`, `src/toggly-config.ts` |
| 5. Order VIP | Entity context without changing user identity | `index.astro`, `src/sample/catalog.ts` |
| 6. Filters matrix | Matching / non-matching presets | `#section-filters`, `catalog.ts` |
| 7. Package-unique | Integration, middleware, x-feature, islands | `astro.config.mjs`, `middleware.ts`, `beta.md`, `src/components/*Island*` |
| 8. Missing App Key | Visible banner, defaults, no crash | `MissingKeyBanner.astro` |

Client import paths that this sample uses (published exports):

- `@ops-ai/astro-feature-flags-toggly/integration`
- `@ops-ai/astro-feature-flags-toggly/client/setup` (injected by the integration)
- `@ops-ai/astro-feature-flags-toggly/client/store`
- `@ops-ai/astro-feature-flags-toggly/react` · `/vue` · `/svelte`
- `@ops-ai/astro-feature-flags-toggly/components/Feature.astro`
- `@ops-ai/astro-feature-flags-toggly/components/FeatureClient.astro`

There is no `@ops-ai/astro-feature-flags-toggly/client` root store export.

## SSG, SSR, and Astro 7 development limit

Production builds may combine React, Vue, and Svelte islands. Current Astro 7
**development** cannot combine React and Vue islands because of the upstream
[vite-plugin-vue #798](https://github.com/vitejs/vite-plugin-vue/issues/798)
Fast Refresh issue. Run a single island framework in development until
upstream fixes it. Do not add fake refresh globals or disable HMR to hide the
issue. `npm test` verifies mixed islands against the production SSR build.

## Honest API gaps

| Capability | Status in this sample |
| --- | --- |
| Country / BrowserFamily / BrowserLanguage / DeviceType / OS filters | Evaluated locally by `@ops-ai/toggly-eval` when request metadata exists, but the published Astro server `buildEvalContext` only passes identity, groups, claims, and entity. Query presets **do not** forge those HTTP fields. Rows show **unsupported** for forged matrix evaluation. |
| `Feature.astro` + offline `flagDefaults` | `Feature` calls `evaluateGate`. Defaults-only mode needs `enableVariants: true` on the middleware client or boolean gates stay false while `getFlag` still returns defaults. This sample enables variants on the integration/middleware for that reason. |
| `Feature.astro` + Order entity offline | With `enableVariants: true`, entity context is ignored on evaluateGate. Offline defaults also lack ContextProperty definitions. Order VIP uses programmatic `getFlag` on a non-variant client; live definitions unlock full entity Feature gates. |
| Runtime `setIdentity` on the browser store | Updates identity only; groups/claims are init-time on the integration inject. Server targeting uses per-request middleware config instead. |
| `@nanostores/svelte` peer | Listed as optional on the SDK; package is not published on npm. Svelte islands use the SDK Svelte helpers that wrap the shared client store. |

## Manual checklist

- [ ] Missing-key banner visible without a real outbound request
- [ ] `new-dashboard` changes server Feature and island content in a live app
- [ ] `api-v2` shows the negated server fallback when disabled
- [ ] VIP Order enables ExpressCheckout without changing identity
- [ ] Variant panel shows an assignment or honestly reports none
- [ ] Matching vs non-matching presets change UserClaims / targeting rows
- [ ] `/beta/` served with default, 404 with `TOGGLY_BETA_ACCESS_DEFAULT=false`
- [ ] Request identity comes from the current URL/middleware, never a shared process client
- [ ] Combined islands work in production; do not claim mixed React+Vue **dev** support
