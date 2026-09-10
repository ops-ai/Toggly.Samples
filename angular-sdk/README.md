# Angular SDK workshop

Follow one feature flag from configuration to a native Angular template, a service check, and a guarded route. Then keep the same user and evaluate two different Orders. This is a browser-only standalone Angular app; it does not add a server or SSR.

## Quick start

Use Node **22.23.2** (with npm **10.9.8**) or a compatible newer Angular-supported Node release. The lockfile installs Angular **22.1.6**, Angular CLI/build **22.1.7**, `@ops-ai/ngx-feature-flags-toggly` **2.8.0**, and Zone.js **0.16.3**.

```sh
cd angular-sdk
npm ci
npm start
```

Open **http://localhost:4200**. Without an App Key, the yellow banner explains offline mode. Recorded payloads feed the **real installed SDK** through its `customDefinitionsUrl`; there are no real Toggly requests. Wait for the checklist to load, then click **new-dashboard: ON**. The native component and directive disappear, the negated fallback appears, and the checklist becomes OFF.

To use your application:

```sh
cp .env.example .env.local
# Set TOGGLY_APP_KEY to your public Toggly App Key.
npm start
```

Restart after changing configuration. Angular has no automatic public environment-variable prefix: [configure.cjs](scripts/configure.cjs) deliberately copies only `TOGGLY_APP_KEY` and `TOGGLY_ENVIRONMENT` into generated browser code. The App Key is public configuration, **not an API/admin secret**. Never put secret tokens into this file or a browser bundle. `.env.local` and the generated file are ignored.

## Why the Angular setup matters

The official application builder is configured with `externalDependencies: ["crypto"]` in [angular.json](angular.json). The SDK's browser verifier uses WebCrypto; its guarded Node import should not be bundled for the browser. This setting does not replace crypto or disable signatures. Use HTTPS or localhost, and do not add a shim that identifies the browser as Node.

[main.ts](src/main.ts) imports Zone.js before bootstrap. [app.config.ts](src/app/app.config.ts) opts into `provideZoneChangeDetection()`, and host components containing native SDK views use `ChangeDetectionStrategy.Eager`. These settings allow the SDK's asynchronous component fields to render on Angular 22. Sample-owned asynchronous display values use signals or the async pipe.

`provideToggly` supplies the standalone application's service. `NgxFeatureFlagsTogglyModule` imports the native component, template and structural directives into each section. No SDK code or component metadata is modified.

## Read the source in this order

| Section              | Start here                                                                                     | What to try                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 01 Home              | [home.html](src/app/home.html), [workshop.ts](src/app/sample/workshop.ts)                      | Toggle `new-dashboard`; compare native gates with the live checklist            |
| 02 Declarative gates | [native-gates.html](src/app/sections/native-gates.html)                                        | `<feature>` with `featureTemplate`, `*featureFlag`, negate, all/any and builder |
| 03 Programmatic API  | [native-gates.ts](src/app/sections/native-gates.ts)                                            | Await `isFeatureOn` before a demo action; turn the Promise into an Observable   |
| 04 Identity          | [config.ts](src/app/sample/config.ts), [workshop.ts](src/app/sample/workshop.ts)               | Switch alice/bob with one native `setContext` call per service                  |
| 05 Entity            | [order-panel.ts](src/app/sections/order-panel.ts)                                              | Compare VIP and Standard Orders through component, directive and builder        |
| 06 Filters           | [filter-matrix.ts](src/app/sections/filter-matrix.ts), [catalog.ts](src/app/sample/catalog.ts) | Compare eleven real SDK results and inspect reference HTTP inputs               |
| 07 Variants          | [variants.ts](src/app/sections/variants.ts)                                                    | Native `*featureVariant` and `getVariant` assignment/configuration              |
| 08 Angular surfaces  | [app.routes.ts](src/app/app.routes.ts), [workshop.ts](src/app/sample/workshop.ts)              | Deny the Beta route, restrict a local gate, simulate failure and recover        |

The SDK returns Promises and offers refresh callbacks. `from(isFeatureOn(...))` is a **one-shot RxJS composition**, not a native `isFeatureOn$` API. The checklist's BehaviorSubject is another small sample bridge: it subscribes to `subscribeFeaturesRefresh` and `subscribeLocalGatesChanged`, reevaluates the real service, and releases subscriptions on destruction. Generation checks discard stale async snapshots after user/Order changes or disposal.

### Two service roles, two initial requests

The root service reads evaluated flags, preserving EntityGate rules for local Order checks. The variants section has a separate injected service with `enableVariants: true`; its flattened variant response cannot carry the root service's Order rule. Each service receives the known alice identity, beta group and admin claim **before its first request**. There are therefore two initial definitions requests, one per endpoint, rather than a startup request followed by a targeting correction.

The sample forwards later identity changes to both services. `setContext` already refreshes: adding another refresh would duplicate network work. Both displays follow native background notifications. Leaving the variants section unsubscribes its bridge and lets Angular destroy its scoped service/socket; returning creates it with the current user. The root session service remains alive across routes.

`registerContext<Order>('Order', mapper)` converts Id/Vip/Total to the native kind/key/attributes shape. The mapper does not register a dashboard schema or change user identity. An EntityGate without the required Order context fails closed. A local prerequisite ANDs with a remote decision; it cannot grant a remotely disabled flag.

## Create the Toggly application

1. In workspace **Toggly Samples**, create **Angular SDK Sample**, select **Angular** technology and **Production** environment.
2. Add allowed Web Origin **http://localhost:4200**.
3. Add context kind **Order**: `Id` string as key, `Vip` boolean, optional `Total` number.
4. Create the following flags and enable them in Production. Copy the public App Key into `.env.local`.

| Key               | Rule                                                   |
| ----------------- | ------------------------------------------------------ |
| `new-dashboard`   | Baseline toggle; switch ON/OFF for the first exercise  |
| `api-v2`          | Baseline toggle for all/any gates                      |
| `enhanced-submit` | Baseline toggle for actions and the local prerequisite |
| `ExpressCheckout` | ContextProperty: `Order.Vip = true`                    |
| `beta-access`     | Baseline toggle for the native route guard             |

Create a **Filters** category with these keys:

| Key                       | Filter configuration                    |
| ------------------------- | --------------------------------------- |
| `filter-always-on`        | AlwaysOn                                |
| `filter-percentage`       | Percentage: 50% sticky by identity      |
| `filter-targeting`        | Targeting: users = `alice`              |
| `filter-user-claims`      | UserClaims: `role = admin`              |
| `filter-time-window`      | TimeWindow: open from 2020 through 2099 |
| `filter-country`          | Country = `US`                          |
| `filter-browser-family`   | BrowserFamily = Chrome                  |
| `filter-browser-language` | BrowserLanguage includes `en`           |
| `filter-device-type`      | DeviceType = **Macintosh**              |
| `filter-os`               | OperatingSystem = **Mac**               |
| `filter-context-property` | ContextProperty: `Order.Vip = true`     |

For the variant section, configure `new-dashboard` with variants **compact** and **comfortable**, and configuration values such as `{"density":"compact"}` and `{"density":"comfortable"}`. Target alice and bob to the respective variants if you want to reproduce the offline assignments. Turning the flag OFF should yield no assigned experience; keep the existing layout in that case.

The **Matching** control sets identity alice, group beta and claim `role=admin`; **Non-matching** sets bob, no groups and `role=user`. Order selection is deliberately independent: use **VIP Order** (`ord-vip`, Vip=true, Total=240) or **Standard Order** (`ord-standard`, Vip=false, Total=60). This makes user-versus-entity scope visible.

The expandable HTTP presets show US/CA, English/French, and Chrome-on-Mac/Firefox-on-Windows reference inputs from the [shared template](../docs/FLAG_TEMPLATE.md). Browser controls cannot override real country or User-Agent headers. Live HTTP filters use the real request seen by Toggly; matching identity alone does not imply matching geography/device. Offline HTTP results and percentage outcomes are labelled recorded fixtures, not a copied filter engine or rollout hash. AlwaysOn and the open TimeWindow remain ON for either preset; a real 50% result is sticky but not prescribed for alice/bob.

## Defaults, recovery and security

The loading state is visible until native checks settle. Live mode verifies signed definitions and uses OFF defaults on an initial failure. `persistCache: false` keeps workshop sessions independent. The SDK's `lastError` retains its most recent diagnostic even after a later successful request, so the alert is labelled historical and the checklist shows current results. The offline failure/recovery controls demonstrate both states.

Feature flags choose presentation; they do not authorize payments, API calls or access to protected data. Claims supplied by a browser are untrusted. The Beta route guard is an interface example, not a server permission boundary. A real backend must independently authenticate and authorize actions.

## Verify it yourself

```sh
# Download the test browser once (CI also installs its system dependencies).
npx playwright install chromium
npm test
TOGGLY_APP_KEY=ci-placeholder TOGGLY_ENVIRONMENT=Production npm run build
```

Tests use deterministic local HTTP/socket transport, not a live service. Unit tests exercise the installed SDK and Angular templates. Their JIT harness explicitly marks views when checking linked SDK components; production acceptance is the separate AOT browser test, which never marks SDK views. Browser tests build missing-key and signed modes, verify native rendering, tamper rejection, identity, Order, route denial/allow, background notifications, subscription/socket cleanup, and desktop/mobile layout. `npm test` forces unit fixtures even if you have a local App Key. `CHROMIUM_EXECUTABLE` may point to an installed Chrome binary; `SCREENSHOT_DIR` optionally saves walkthrough images.

Manual checklist:

- Wait for the ON checklist before clicking. Disable `new-dashboard`: native content disappears and negate appears; all/any react to `api-v2`.
- Disable the device prerequisite: enhanced submit is denied. Reenable it while the remote flag is OFF: it stays denied.
- Keep alice selected and change Order: Express Checkout changes without changing identity.
- Switch to bob: targeting/claims change and the variant becomes comfortable with the matching dashboard rules.
- Disable `beta-access`: navigation stays on the workshop. Reenable it: the Beta page opens.
- In offline mode, fail/recover transport: OFF defaults recover while the most recent diagnostic remains visible.
- With a real App Key, change a flag in the dashboard without clicking sample controls: native gates, checklist and filter matrix should update together.

See the [Angular SDK guide](https://docs.toggly.io/sdks/javascript/angular) and [Sample Contract](../docs/SAMPLE_CONTRACT.md).
