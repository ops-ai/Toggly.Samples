# React SDK Showcase

A browser-first React 19 + Vite walkthrough for the published
[`@ops-ai/react-feature-flags-toggly`](https://www.npmjs.com/package/@ops-ai/react-feature-flags-toggly)
package. It teaches a first boolean toggle before identity, Order context,
filters, variants, and live definition updates.

## Quick start

```bash
cd react-sdk
cp .env.example .env.local
# Add your public Toggly App Key to .env.local for live definitions.
npm ci
npm run dev
```

Open <http://localhost:5173>. With an empty key, the app remains usable: it
shows a visible configuration banner, supplies false local defaults, and does
not start remote polling or a WebSocket. That is useful for learning the UI,
but it does not prove a Toggly application, flag, origin, or network connection
exists.

`VITE_TOGGLY_APP_KEY` and `VITE_TOGGLY_ENVIRONMENT` are embedded in the browser
bundle by Vite. Restart development or rebuild deployment after changing them.
The app key is public configuration for evaluated definitions; never put a
management API key, bearer token, or other secret in a `VITE_` variable.

## Your first toggle

1. Start with `.env.local` empty. Read the missing-key banner: every sample
   default is false, so no unconfigured feature becomes visible by accident.
2. Configure the dashboard app below, set `VITE_TOGGLY_APP_KEY`, restart Vite,
   and open **Home: your first toggle**.
3. Turn `new-dashboard` on in **Production**. The declarative green branch and
   live snapshot should turn on after the SDK gets evaluated definitions.
4. Turn it off. The explicit `<Feature negate>` branch should appear instead.

A feature key selects an application behavior; an environment selects which
rules answer that key. A client-side visibility gate is never authorization:
protect APIs and data on the server too.

## Read the source in this order

| File | Why it matters |
| --- | --- |
| [`.env.example`](.env.example) | Browser-visible configuration and its fallback behavior |
| [`src/main.tsx`](src/main.tsx) | One provider, initial session identity, and the registered Order mapper |
| [`src/sample-config.ts`](src/sample-config.ts) | False defaults, session identity creation, and the canonical Order shape |
| [`src/DemoPanels.tsx`](src/DemoPanels.tsx) | Declarative gates, hooks, service calls, identity, entities, filters, and variants |
| [`src/toggly.tsx`](src/toggly.tsx) | Programmatic evaluation plus refresh subscription |
| [`src/filter-catalog.ts`](src/filter-catalog.ts) | The eleven-row matrix and honest browser limitations |

## Set up the Toggly application

1. In [app.toggly.io](https://app.toggly.io), create **React SDK Sample** in a
   workspace you can manage. Select **React** if it is available, use
   **Production**, and add the allowed web origin `http://localhost:5173`.
2. Create context kind **Order** with `Id` as a string key, `Vip` as a boolean,
   and `Total` as an optional number. Bind `ExpressCheckout` and
   `filter-context-property` to that context kind before adding their rules.
3. Create baseline flags `new-dashboard`, `api-v2`, `enhanced-submit`,
   `ExpressCheckout`, and `beta-access`.
4. Create the Filters category and all eleven `filter-*` flags using the exact
   rules and matching/non-matching inputs in
   [`../docs/FLAG_TEMPLATE.md`](../docs/FLAG_TEMPLATE.md).
5. Copy the public Production app key to `.env.local` as
   `VITE_TOGGLY_APP_KEY`, restart the dev server, and repeat the first-toggle
   exercise.

The full app and management instructions are in
[`../docs/APP_SETUP.md`](../docs/APP_SETUP.md). Do not invent a picker label if
your dashboard uses a different technology name; keep the correct app and use
the available matching browser technology.

## What each section demonstrates

| Section | SDK surface | What to verify manually |
| --- | --- | --- |
| Home + snapshot | provider defaults and `isFeatureOn` | Key checklist and live state are visible |
| Declarative gates | `Feature`, `negate`, variant, multi-key `any`, `useFeatureFlag`, `useFeatureGate` | Toggle `new-dashboard` and `api-v2` |
| Programmatic API | `isFeatureOn`, `evaluateFeatureGate` | Re-evaluate the API flag and multi-key decision |
| Session identity | provider `identity`, later `setContext` | `alice`/`admin` and `bob`/`user` change evaluated definitions |
| Order entity context | `registerContext`, per-check `context` | `ord-vip` passes `ExpressCheckout`; `ord-standard` does not |
| Filters matrix | evaluated browser context plus Order row | Compare matching/non-matching preset rows |
| React SDK surfaces | render prop and `useVariant` | Create a variant assignment and observe its name |
| Missing-key banner | no-key provider options | Empty configuration does not crash or fetch malformed definitions |

## Identity, context, refresh, and cache

The startup code creates one stable identity per browser tab in
`sessionStorage` and passes it directly to `createTogglyProvider`. This is why
the first evaluated-definitions request can target that identity without an
extra `setContext` request. Use `setContext` only after the user’s client-side
session changes; the published SDK applies that context and refreshes strictly.

The React browser SDK accepts `identity`, `groups`, and string `claims` as
evaluation context. The sample does not fake country, language, device, OS, or
user-agent data: those rows come from the real browser/network request and are
labelled as such in the matrix. `alice` and `role=admin` are teaching values,
not authentication claims. Do not authorize work from editable browser context.

An `Order` is different from user context. The sample registers a mapper once,
then passes each Order at the `<Feature>` or `isFeatureOn` callsite. That keeps
the VIP and standard Order decisions independent. Remote definitions are
cached by the SDK when a key is configured; later HTTP or live WebSocket refresh
events update the component and programmatic snapshot. After a successful load,
refresh failures retain the last known definitions; this sample logs the SDK
error and keeps safe fallback behavior rather than crashing.

## Filter support

All shared rows are shown. Percentage is sticky by identity, so Alice and Bob
do not have a prescribed result. Time window is owned by the dashboard rule.
Targeting and User Claims use the selectable identity/claim controls. Context
Property uses the VIP/standard Order examples. Country, browser family,
language, device type, and OS are observable only through the actual browser
and network request in this browser SDK; there is no supported per-call header
override. Their rows remain in the matrix so that the gap is explicit.

## Package versions

- `@ops-ai/react-feature-flags-toggly` `1.12.0` (published npm package)
- React and React DOM `19.3.0`
- Vite `8.3.0`
- TypeScript `7.0.2`
- Vitest `5.0.0`

The React SDK declares peer support for React and React DOM
`^18.2.0 || ^19.0.0`. This showcase uses the current React 19 host and does not
use a local SDK tarball.

## Verification and manual checklist

```bash
npm ci
npm test
VITE_TOGGLY_APP_KEY=ci-placeholder VITE_TOGGLY_ENVIRONMENT=Production npm run build
```

For live verification, use a real local App Key only in `.env.local`:

- [ ] `new-dashboard` swaps declarative and negate branches.
- [ ] `api-v2` changes both the programmatic and multi-key result.
- [ ] `alice` with `role=admin` and `bob` with `role=user` exercise the
  targeting/claims setup.
- [ ] VIP and standard Orders produce different `ExpressCheckout` decisions.
- [ ] The matching and non-matching filter preset rows match the configured
  dashboard rules, with browser/network rows checked in an actual matching
  browser or network.
- [ ] A configured variant appears in **React SDK surfaces**.
- [ ] Removing the local key restores the banner and safe false defaults.

## Browser telemetry

The **Telemetry** section uses the service from this sample's existing provider.
It does not create a second reporter or persist a telemetry queue.

- **Evaluate telemetry feature** evaluates `new-dashboard` once. Checks elsewhere
  in the showcase are also collected automatically.
- **Record usage** and **Record view** are explicit button interactions. Rendering
  the panel records neither. This panel labels these events `enabled`/`disabled`
  from its last boolean evaluation; the React surfaces panel demonstrates named
  experiment assignments separately.
- **Increment counter** adds one to `sample-actions`; **Set gauge** sets
  `sample-cart-size` to three. Configure those metric keys and types in your
  sample application before expecting aggregated values.
- **Flush telemetry** attempts delivery. Success of that call is not proof of
  ingestion or aggregation.

Collection defaults on with a public app key. Set
`VITE_TOGGLY_ENABLE_TELEMETRY=false` before provider creation to opt out, then
restart the dev server or rebuild. Evaluations still work with collection off.
A missing key uses the existing local false defaults and sends no requests.
`VITE_TOGGLY_METRICS_BASE_URL` optionally overrides the default
`https://metrics.toggly.io` collector. All `VITE_` settings are public browser
configuration; never put a management credential there.

`npm test` includes integration with the installed public SDK and exact compact
packet assertions. To verify the actual browser, run
`npx playwright install chromium` followed by `npm run test:browser`.
Three owned Vite servers exercise collection enabled, opt-out and no-key modes.
They use only dummy configuration; every external HTTP/WebSocket request is
intercepted and the metrics host is `.invalid`. Tests send no production traffic.
`CHROMIUM_PATH` can point to an existing Chromium binary for local runs.
