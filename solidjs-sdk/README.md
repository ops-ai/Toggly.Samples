# SolidJS SDK sample

An interactive browser workshop for `@ops-ai/solid-feature-flags-toggly` **0.3.0** and SolidJS 1.9. It demonstrates the native provider, accessors, gates, resource, targeting and cleanup. This sample uses client rendering; it does not demonstrate SolidStart SSR.

## Quick start

Use Node 22.12+ and npm:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5173. An empty app key starts safely with visible offline defaults and a missing-key banner. No account credentials or fabricated keys are included. `npm test` exercises this offline mode; `npm run build` type-checks and builds the browser application.

## Create your Toggly application

Follow [app setup](../docs/APP_SETUP.md) and the [flag template](../docs/FLAG_TEMPLATE.md). Name the application **SolidJS SDK Sample**, select the matching browser technology available in your dashboard, use **Production**, and allow the exact web origin `http://localhost:5173`. Do not invent a technology picker label if your workspace lacks SolidJS. Create the complete flag checklist shown on Home. Define context kind **Order** with **Id** as its key and **Vip** as a boolean; bind ExpressCheckout and filter-context-property to Order and add `Vip = true`.

Put the browser app key in `.env` as `VITE_TOGGLY_APP_KEY`. `VITE_TOGGLY_ENVIRONMENT` defaults to Production. Both variables are public, replaced into JavaScript by Vite at build time, and require restarting development/rebuilding deployment when changed. Never put a management API credential in a `VITE_` variable.

## First-toggle exercise

1. With a configured key, enable `new-dashboard` in Production and select Refresh definitions. Expect **New dashboard**.
2. Disable the flag and refresh. Expect **Classic dashboard** in the negated block and `false` from Evaluate dashboard.
3. Enable `api-v2`; disable Device ready for API v2. The local prerequisite holds API v2 even though its remote definition is on.
4. Remove the app key and restart. The configuration banner appears; defaults make new-dashboard and api-v2 true. Remote targeting and Order predicates are **not simulated** in offline mode.

A key identifies a feature. Definitions belong to an app/environment. Initialization fetches evaluated signed definitions; reads resolve a boolean or an entity gate. Missing definitions are false. Defaults provide initial/failure values; later same-session failures preserve last-known data and expose an error. Changing identity resets previous results before fetching. This sample opts into localStorage for exact signed envelopes and their verified public key. The cache key includes targeting identity/groups/claims. After an online refresh, a fresh client with the same targeting can restore verified definitions with all service requests offline. Page assets still need an application-owned offline shell or a reachable local server; this sample does not install a service worker. Current key pins, expiry and age policy still apply. Live updates invalidate definitions automatically and Refresh explicitly retrieves a current snapshot.

## Sections

| Section           | Source and exercise                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Home              | App.tsx: map, complete flag checklist, live definitions snapshot and first toggle                                                    |
| Declarative gates | Paired Feature/negate blocks, loading, all and any; boolean alternative explicitly distinguished from unsupported variant assignment |
| Programmatic API  | Synchronous evaluate and an enhanced-submit guard; local demonstration only                                                          |
| Identity          | Provider-scoped identity, groups and claims; Matching/Non-matching and explicit reset                                                |
| Entity context    | Order mapper in catalog.ts carries key and Vip attributes per read                                                                   |
| Filters matrix    | Every shared filter flag, matching/non-matching presets and honest input-source limits                                               |
| Solid ownership   | Signal/accessor updates, resource/Suspense, lazy branches and device-local gate                                                      |
| Configuration     | Visible missing-key banner and environment/refresh/cache explanations                                                                |

## Filters and expected results

Matching applies identity alice, groups staff, role=admin and VIP Order. Non-matching applies bob, empty groups, role=user and a standard Order. Configure filter-targeting users=alice and filter-user-claims role=admin with segment percentage 100; the two presets should then enable and disable these flags respectively. Configure filter-context-property Order.Vip=true to see the same split locally after definitions load.

AlwaysOn should remain enabled for either preset. TimeWindow is governed by the service clock and configured window. Percentage 50% is sticky by identity; neither preset promises a specific result. Country, browser family, browser language, device and OS are evaluated from the **actual browser/network request**. Browser JavaScript cannot spoof User-Agent or IP country through these controls. Those matrix rows display real service results, not fabricated preset matches. See the shared flag template for Chrome/macOS and Firefox/Windows test conditions; use suitable real browsers/networks to verify them.

This SDK has no variant assignment API; a boolean alternative is ordinary UI branching. The telemetry exercise demonstrates explicit usage/view events, counters and gauges through the provider's single browser reporter. Telemetry is enabled by default with an app key; set `VITE_TOGGLY_ENABLE_TELEMETRY=false` to opt out. `VITE_TOGGLY_METRICS_BASE_URL` optionally overrides the metrics endpoint independently of definitions. Usage/view actions use the documented sample variant; rendering does not imply a view. Define the `orders` counter and `active-carts` gauge in the Toggly application before expecting server-side business metric acceptance. Presentation and demo claims are not authentication; a server must authorize real operations independently.

## Source-reading map

Start at `src/index.tsx` (browser mount), then `src/App.tsx` (provider configuration and eight sections), `src/catalog.ts` (keys/defaults/targeting presets/entity mapper), and `tests/workshop.test.tsx` (offline behavior). Comments at configuration, context and local-gate callsites explain their boundaries. The [SDK guide](https://docs.toggly.io/sdks/javascript/solid) documents every supported option.

## Manual checklist

- Missing key: banner visible, no definitions request, defaults render.
- Live key: valid signature loads snapshot; invalid signature/network error stays visible and does not apply untrusted flags.
- Flip new-dashboard and verify gate, negate and accessor agree after refresh/live update.
- Apply both targeting presets; prior user's flags clear during the new request.
- Toggle Order.Vip and verify ExpressCheckout follows its configured entity rule.
- Disable device readiness and verify api-v2 cannot remain enabled locally.
- Inspect every filter row with the input limitations above.
- Unmount the provider and verify its socket/timers/fetches stop.

Offline tests and builds do not prove live dashboard provisioning, service connectivity or real rollout results.

### Verify signed restart recovery

Configure a real frontend app key, load the page online and refresh definitions. Keep the page host available, block all requests to the definitions service (including `/.well-known/jwks`), then reload with the same targeting. Previously verified flags remain available and the failed refresh is visible. A different identity must not inherit those cached flags. Clear the sample origin's localStorage when finished because its keys contain targeting data. The SDK regression suite additionally verifies a new client with every network request rejected.
