# JavaScript SDK Sample

Vanilla TypeScript and Vite sample for the published `@ops-ai/feature-flags-toggly` browser SDK.

## Quick start

```bash
cd javascript-sdk
cp .env.example .env.local
# Set VITE_TOGGLY_APP_KEY for live evaluation.
npm install
npm run dev
```

Open <http://localhost:5173>. With no key, or with the CI placeholder, the app clearly labels offline defaults and makes no Toggly network request.

## Your first flag, step by step

A feature flag chooses between behaviors using a stable key, such as `new-dashboard`.
Your code contains both branches; Toggly supplies the decision. An **environment**
selects the rules for that application (for example Production versus Staging).
The key must match exactly, and changing a rule in one environment does not change
which environment this app requests. A hidden browser button is not authorization:
your server still needs to check permissions for protected operations.

1. Start with the app key blank. The **Missing app key** banner and **offline
   placeholder** label identify the local exercise. `new-dashboard` is ON,
   `api-v2` is OFF, the new dashboard branch is visible, and the classic fallback
   is hidden. **All keys** is OFF while **Any key** is ON. No named variant is
   assigned. These are hardcoded teaching values, not dashboard definitions.
2. Read `createSnapshot` in [`src/demo.ts`](src/demo.ts). Predict the results if
   `new-dashboard` becomes false. For a local experiment, temporarily change only
   that boolean in `defaults` in [`src/main.ts`](src/main.ts), then reload the
   page: both multi-key gates become OFF and the classic fallback becomes visible.
   Restore the value afterward. Inverting an `all` gate means **at least one is
   off**, not **all are off**.
3. To control the flag from Toggly, complete the provisioning steps below. Put the
   public application key in `.env.local`, select its environment, and restart
   `npm run dev`. `VITE_` is Vite's convention for exposing configuration to the
   browser; it is not a special Toggly key type. This value is passed as `appKey`
   to the SDK. Never put management/API secrets in a `VITE_` variable. Production
   changes require rebuilding/redeploying because Vite embeds the values at build
   time. `Production` here names the Toggly environment, not Vite's build mode.
4. Confirm the missing-key banner disappears and read the evaluation status. A
   configured key alone does not prove a successful fetch: **unavailable or cached**
   means the visible values may be fallback data. Browser Network tools can show
   the definitions request and its outcome. Live provisioning/checks remain pending
   for this sample; the local tests do not prove your dashboard is configured.
5. In the selected dashboard environment, switch `new-dashboard` off, then click
   **Refresh definitions** and wait for completion. With successful definitions,
   the new branch hides and the classic branch appears. Switch it on again and
   repeat. WebSocket updates can trigger the same redraw, but are asynchronous
   and network-dependent; this is not an instant-delivery guarantee.
6. Set `api-v2` on too: **All keys** and **Any key** should both be ON. A named
   variant requires separate variant configuration (see below); a boolean flag
   by itself does not perform an experiment assignment.

## Read the source in this order

| File | Follow this question |
|------|----------------------|
| [`.env.example`](.env.example) | Which values are browser-visible, and when are they loaded? |
| [`src/main.ts`](src/main.ts) | How does the bundle expose `window.Toggly`, register Order, await initialization, and repaint after refresh? |
| [`src/demo.ts`](src/demo.ts) | How do live configuration and offline fixtures differ, and how do boolean gates combine? |
| [`src/sample-app.ts`](src/sample-app.ts) | How do SDK results become DOM branches, refreshed identity, per-order checks, and honest filter labels? |
| [`src/toggly.d.ts`](src/toggly.d.ts) | Which narrow declarations bridge the published artifact's missing typings? |
| [`tests/published-sdk.test.ts`](tests/published-sdk.test.ts) | Which gates, entity rules, variants and hooks are exercised against the installed SDK? |

## Initialization, defaults, and refresh

`main.ts` awaits `Toggly.init` before mounting the page, then uses synchronous
`isFeatureOn` and `evaluateFeatureGate` reads. Waiting establishes that the load
attempt finished; it does not guarantee a live response. `lastError` is therefore
checked alongside the Promise outcome. A refresh failure can preserve previously
loaded or cached values. In live mode this sample supplies **no `flagDefaults`**;
on a fresh load without usable definitions/cache, missing flags read OFF. A negated
check can still show the fallback branch. In offline mode, only the explicitly
listed defaults are ON/OFF fixtures; omitted keys are OFF. Clicking filter presets
cannot change these fixed booleans or simulate a real worker evaluation.

The `afterRefresh` hook redraws the DOM after later SDK refreshes; its optional
`app` reference handles a callback occurring before mounting. Live configuration
uses the SDK's default refresh/WebSocket behavior. Offline configuration disables
live updates and flag/variant cache persistence. This does **not** disable stored
identity and claims.

## Configure the Toggly app

1. Sign in at [app.toggly.io](https://app.toggly.io). Use a workspace you can manage (the one from signup is enough).
2. Create application **JavaScript SDK Sample**, choose JavaScript as the technology and **Production** as the environment.
3. Add allowed web origin `http://localhost:5173`.
4. Create context kind **Order** with `Id` (string, key), `Vip` (boolean), and optional `Total` (number).
5. Create `new-dashboard`, `api-v2`, `enhanced-submit`, `ExpressCheckout`, and `beta-access` exactly as described in [`../docs/FLAG_TEMPLATE.md`](../docs/FLAG_TEMPLATE.md).
6. Create the **Filters** category and every `filter-*` flag from that template, with the listed rules and presets.
7. Copy the Production app key into `.env.local` as `VITE_TOGGLY_APP_KEY`; never commit it.

## Package versions

- `@ops-ai/feature-flags-toggly` `1.8.0`
- Vite `8.3.0`
- TypeScript `7.0.2`
- Vitest `5.0.0`
- jsdom `30.0.1` (browser interaction tests)

The published SDK package points its `types` field at a declaration file that is absent from the npm artifact. `src/toggly.d.ts` narrowly describes only the published-artifact-verified APIs used by this sample. The published artifact is a browser IIFE which exposes `window.Toggly`, so the sample loads it for that documented global rather than claiming named ESM exports.

## Sections

| Hash | Contract section | What it demonstrates |
|------|------------------|----------------------|
| `#home` | Home | Map, shared flag checklist, and live or labelled offline snapshot |
| `#gates` | Declarative gates | DOM-rendered feature, negate, variant, all-key, and any-key gates |
| `#api` | Programmatic API | `isFeatureOn`, `evaluateFeatureGate`, `getVariant`, and `refresh` |
| `#identity-section` | Identity | Actual SDK identity/claims applied with `setContext` and their browser-wide storage limitation |
| `#entity` | Entity context | Per-evaluation `Order` context with `Vip` |
| `#filters` | Filters matrix | Shared matching/non-matching inputs and honest capability labels |
| `#unique` | Package-unique surfaces | Browser global, WebSocket refresh, variants, defaults, context registration |
| `#configuration` | Missing-key banner | Visible configuration state without a crash or network call |

## Filter support

A filter is a condition in a flag's dashboard rules, not a second flag API.
Targeting uses the SDK identity (and any active groups), User Claims uses supplied
claim values, Percentage uses a stable identity for a repeatable decision, and
Time Window uses the configured schedule. The paired presets correspond to the
shared flag template, so their names are not a guarantee under arbitrary rules.

`alice`/`role=admin` and `bob`/`role=user` are demonstration inputs, not authenticated
accounts. At startup, the sample seeds Alice only if no SDK identity exists.
`setContext` updates identity/claims and awaits a definitions refresh; omitted
fields such as existing groups are retained. Reloading the page does not reset
that stored context. Inspect the **Evaluated identity** and role, not just the
requested preset name. Do not use these browser-editable values to authorize work.

For Order, `registerContext` maps `orderId` to `key` and `vip` to `attributes.Vip`.
It registers a local mapper, not a dashboard kind. Each `isFeatureOn(..., preset,
'Order')` call supplies the current order so a returned entity rule can be evaluated
locally. One user can therefore see different checkout results for different
orders. A returned entity rule without its required context evaluates OFF. Do not
read an object from `featureFlagsValue` as a truthy boolean in place of this API.

Identity and claims are worker-evaluated after `setContext` refreshes definitions. The published SDK stores them in origin-wide `localStorage`; it has no supported storage adapter or per-call identity/claims option, so separate tabs on the same origin can affect one another. The page displays the SDK's actual active context next to requested preset values. `Order` is supplied directly to both `ExpressCheckout` and `filter-context-property` evaluations.

The browser SDK does not offer per-call overrides for country, `Accept-Language`, or `User-Agent`; those preset values are display-only. The matrix shows the actual returned country/browser/language/device/OS results and does not claim that clicking a preset forced those request properties. Percentage results remain sticky by SDK identity.

For the named-variant example, enable variants on `new-dashboard`, add a variant such as **treatment-blue**, and optionally give it JSON configuration such as `{ "cta": "Try blue" }`. The declarative section renders named variant content from `getVariant`; when no variant is assigned it renders an explicit default-content fallback.

## Manual live checklist (pending)

- [ ] Complete the Toggly app provisioning steps above and use a real Production key.
- [ ] Missing key shows the offline banner, does not crash, and sends no Toggly request.
- [ ] `new-dashboard` flips the feature and negated gates; `api-v2` changes all/any multi-key results.
- [ ] A configured variant for `new-dashboard` appears by name.
- [ ] Refresh and live WebSocket updates reflect dashboard flag changes.
- [ ] Identity `alice` with `role=admin` appears as the actual evaluated context and refreshes worker-evaluated values; verify the documented same-origin cross-tab limitation.
- [ ] `ord-vip` with `Vip=true` enables `ExpressCheckout`; `ord-standard` with `Vip=false` disables it.
- [ ] Matching and Non-matching controls show exact shared preset values and mark unsupported overrides as display-only.
- [ ] Actual browser filter results agree with the browser/request in use; percentage stays stable for an identity.
- [ ] `.env.local` remains ignored by Git.

## Verification

```bash
npm ci
npm test
VITE_TOGGLY_APP_KEY=ci-placeholder VITE_TOGGLY_ENVIRONMENT=Production npm run build
```
