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

## Configure the Toggly app

Provisioning is pending because <https://app.toggly.io> currently redirects this work session to sign-in. To complete it manually:

1. Sign in and select workspace **Toggly Samples**.
2. Create application **JavaScript SDK Sample**, choose JavaScript as the technology and **Production** as the environment.
3. Add allowed web origin `http://localhost:5173`.
4. Create context kind **Order** with `Id` (string, key), `Vip` (boolean), and optional `Total` (number).
5. Create `new-dashboard`, `api-v2`, `enhanced-submit`, `ExpressCheckout`, and `beta-access` exactly as described in [`../docs/FLAG_TEMPLATE.md`](../docs/FLAG_TEMPLATE.md).
6. Create the **Filters** category and every `filter-*` flag from that template, with the listed rules and presets.
7. Copy the Production app key into `.env.local` as `VITE_TOGGLY_APP_KEY`; never commit it.

## Package versions

- `@ops-ai/feature-flags-toggly` `1.7.4`
- Vite `8.2.2`
- TypeScript `7.0.2`
- Vitest `5.0.0`

The published SDK package points its `types` field at a declaration file that is absent from the npm artifact. `src/toggly.d.ts` narrowly describes only the source-verified APIs used by this sample. The published artifact is a browser IIFE which exposes `window.Toggly`, so the sample loads it for that documented global rather than claiming named ESM exports.

## Sections

| Hash | Contract section | What it demonstrates |
|------|------------------|----------------------|
| `#home` | Home | Map, shared flag checklist, and live or labelled offline snapshot |
| `#gates` | Declarative gates | DOM-rendered feature, negate, variant, all-key, and any-key gates |
| `#api` | Programmatic API | `isFeatureOn`, `evaluateFeatureGate`, `getVariant`, and `refresh` |
| `#identity` | Identity | Browser-tab identity in `sessionStorage`, applied explicitly with `setContext` |
| `#entity` | Entity context | Per-evaluation `Order` context with `Vip` |
| `#filters` | Filters matrix | Shared matching/non-matching inputs and honest capability labels |
| `#unique` | Package-unique surfaces | Browser global, WebSocket refresh, variants, defaults, context registration |
| `#configuration` | Missing-key banner | Visible configuration state without a crash or network call |

## Filter support

Identity and claims are worker-evaluated after `setContext` refreshes definitions. `Order` is supplied directly to the entity evaluation. The browser SDK does not offer per-call overrides for country, `Accept-Language`, or `User-Agent`; those preset values are display-only. The matrix shows the actual returned country/browser/language/device/OS results and does not claim that clicking a preset forced those request properties. Percentage results remain sticky by identity.

## Manual live checklist (pending)

- [ ] Complete the Toggly app provisioning steps above and use a real Production key.
- [ ] Missing key shows the offline banner, does not crash, and sends no Toggly request.
- [ ] `new-dashboard` flips the feature and negated gates; `api-v2` changes all/any multi-key results.
- [ ] A configured variant for `new-dashboard` appears by name.
- [ ] Refresh and live WebSocket updates reflect dashboard flag changes.
- [ ] Identity `alice` with `role=admin` is scoped to the current browser tab and refreshes worker-evaluated values.
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
