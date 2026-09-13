# Remix SDK Sample

A full Toggly feature-flag showcase for Remix 2.17. It uses the published
`@ops-ai/remix-toggly-core`, `@ops-ai/remix-toggly-server`, and
`@ops-ai/remix-toggly-client` packages; it never uses a local tarball.

## Try your first toggle

A feature flag is a named decision. Its **key** is the string in code, such as
`new-dashboard`; its **definition** is the rule configured in Toggly; and an
**environment** selects a distinct set of definitions within one application.
An evaluation applies that definition to a request, an identity, and optionally
an entity such as an Order.

1. Complete the quick start and create `new-dashboard` as an initially disabled
   baseline flag in Production.
2. Open `/gates`. The `negate` branch explains that the legacy view is active.
3. Enable the flag in Toggly, wait for a definition refresh, and refresh the
   browser. The enabled UI branch should appear without changing the deployed
   application code.
4. If a result is unexpected, first check the exact app key, application,
   environment, and flag key. An offline test or successful build does not prove
   your Toggly dashboard application is provisioned or reachable.

## Quick start

```bash
cd remix-sdk
cp .env.example .env
# Set TOGGLY_APP_KEY and REMIX_PUBLIC_TOGGLY_APP_KEY to your application's key.
npm ci
npm run dev
```

Open <http://localhost:5173>. The app intentionally does not crash with blank
keys: it shows a banner and safely treats unknown flags as off.

## Configure your Toggly application

1. At [app.toggly.io](https://app.toggly.io), create **Remix SDK Sample** in a
   workspace you manage. Choose the Remix technology and Production environment.
   Use `http://localhost:5173` as the local URL and allowed browser origin.
2. Create context kind **Order**, with `Id` (string, key), `Vip` (boolean), and
   `Total` (number). Bind `ExpressCheckout` and `filter-context-property` to it.
3. Create baseline flags: `new-dashboard`, `api-v2`, `enhanced-submit`,
   `ExpressCheckout`, and `beta-access`. Configure `ExpressCheckout` as
   ContextProperty `Order.Vip = true`.
4. Create the `Filters` category and the eleven `filter-*` flags described in
   [the shared template](../docs/FLAG_TEMPLATE.md). Restrictive rules must not
   have an extra AlwaysOn rule.

The sample has no management token and cannot create dashboard entities for you.
Use the [application setup guide](../docs/APP_SETUP.md) when a filter is missing
from the picker.

## Environment variables and browser boundary

`TOGGLY_APP_KEY` is read by loaders and actions. `REMIX_PUBLIC_TOGGLY_APP_KEY`
is serialized into browser JavaScript for `RemixTogglyProvider`; it must be an
application key, never a management token or another secret. Vite substitutes
browser values while building, so restart development or rebuild production
assets after changing it. `TOGGLY_ENVIRONMENT` defaults to `Production`.

## Read the source in this order

| File / route | What to learn |
|---|---|
| `app/lib/toggly.server.ts`, `app/root.tsx` | config, hydration, local evaluation, safe missing-key fallback |
| `/gates`, `app/components/client-gates.tsx` | declarative feature, negate, multi-key, and browser hooks |
| `/programmatic` | `createTogglyLoader` and `createTogglyAction` surfaces |
| `/identity` | cookie to request-scoped async evaluation context |
| `/orders` | domain Order to `Order.Vip` mapper and entity gate |
| `/filters` | every shared filter row evaluated using matching/non-matching inputs |

## Sections

| Route | Package surface | What it demonstrates |
|---|---|---|
| `/` | client provider | map, checklist, and live hydrated snapshot |
| `/gates` | `remix-toggly-client` | Feature, negate, FeatureSwitch, FeatureGate, hooks |
| `/programmatic` | `remix-toggly-server` | loader/action helpers and raw client checks |
| `/identity` | `remix-toggly-server` | request-only identity, claims, and request headers |
| `/orders` | core + server | registered `Order` entity context for ExpressCheckout |
| `/filters` | core + server | all eleven contract filter rows and both presets |

## Package versions

- `@remix-run/dev`, `@remix-run/node`, `@remix-run/react`, `@remix-run/serve` `2.17.5`
- `react`, `react-dom` `18.3.1` (required by the published client peer range)
- `@ops-ai/remix-toggly-core` `1.9.0`
- `@ops-ai/remix-toggly-server` `1.10.0`
- `@ops-ai/remix-toggly-client` `1.4.0`

## Evaluation, refresh, cache, and limitations

The server example chooses `evaluationMode: 'local'`: it fetches signed
definitions and evaluates each call using the request's own context. It does not
set an SDK client's shared identity from a loader or action. The provider can
hydrate the server snapshot and refresh browser flags. A refresh failure can
leave an earlier snapshot visible; inspect the configured key and network error,
not merely an on/off result.

`Feature` and `FeatureGate` change presentation. They are not authorization.
The action page therefore demonstrates a second server-side evaluation but still
does not represent a production authorization policy.

The published client has `useABTest`, which maps a **boolean** to two labels. It
does not expose a dashboard experiment-assignment value or `FeatureVariant`.
The label is shown honestly as a UI branch, not as experiment cohort or metrics.
Browser hooks also do not let this sample inject arbitrary User-Agent,
Accept-Language, or country values into a live browser; `/filters` evaluates
those shared presets on the server. Browser filter verification needs a real
browser request, configured rule, and connected dashboard app.

## Manual checklist

- [ ] Blank server/public keys show a banner and every route stays reachable.
- [ ] `/` shows the route map, baseline checklist, and a hydrated snapshot.
- [ ] `/gates` shows Feature, negate, FeatureSwitch, and all-of-two gate after
      turning on `new-dashboard` and `api-v2`.
- [ ] `/programmatic` reflects `new-dashboard` and action behavior reflects
      `enhanced-submit`.
- [ ] `/identity` sets `alice` without leaking that identity into another
      request; inspect `requestContext` instead of a mutable singleton.
- [ ] `/orders?id=ord-vip` enables ExpressCheckout and `ord-standard` disables
      it when the shared Order context is configured.
- [ ] `/filters` matching evaluates alice/admin/US/Chrome/Mac/en/VIP; the
      non-matching preset evaluates bob/user/CA/Firefox/Windows/fr/standard.
- [ ] Confirm AlwaysOn and an open TimeWindow stay on; Percentage remains
      identity-sticky and therefore has no prescribed value.
