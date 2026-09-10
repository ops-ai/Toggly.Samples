# Docusaurus SDK workshop

A Docusaurus 3 site that takes one feature flag through native MDX/React components, a programmatic action, a live filter matrix and a real core Order mapper. It uses the published **@ops-ai/toggly-docusaurus-plugin 0.8.0** and **@ops-ai/toggly-client-core 0.3.0**, with **Docusaurus 3.10.2** and **React 19.3.0** recorded in the lockfile.

## Run the workshop

Use Node **22.23.2+**:

```sh
cd docusaurus-sdk
npm ci
npm start
```

Open **http://localhost:3000**. No App Key is needed for the labelled **OFFLINE DEFAULTS** workshop. Native SDKs consume deterministic recorded values; no Toggly requests are made in this mode.

## Your first flag

1. Find `new-dashboard` in the Home checklist. It starts ON offline.
2. Switch it OFF. Native `Feature` removes the new UI; its negated sibling shows the existing UI. The checklist and `useFlag` hook agree.
3. Keep `api-v2` ON. The sample's **all** result is OFF, but **any** is ON. These are explicitly composed booleans, not an invented native multi-key component.
4. Check submit, then turn the device prerequisite off and check again. The local AND can deny an enabled flag; it never enables a denied flag.
5. Select bob and compare the recorded filter matrix. Pick VIP/standard Order: Express Checkout changes without changing the user.
6. Open the MDX Beta guide. Inspect its `x-feature` frontmatter and native `Feature flag`/`negate` examples.
7. Exercise safe OFF defaults, then restore the recorded values. This control replaces defaults; it does not pretend a network request failed.

## Connect your application

```sh
cp .env.example .env.local
# Edit TOGGLY_APP_KEY, then restart npm start (or rebuild).
```

`TOGGLY_APP_KEY` is the public application key; `TOGGLY_ENVIRONMENT` defaults to Production. Docusaurus evaluates its config in Node at build/start time. The plugin serializes these values into JavaScript and HTML, so the App Key is visible to readers. Never place management keys or private credentials here. `.env.local` is ignored by Git.

Live mode requires signed responses. Offline toggle/default buttons are disabled; change flags in Toggly and observe native polling update the UI and checklist together. A one-second interval makes this teaching exercise responsive; use an appropriate longer refresh interval in a production application.

Identity is supplied before each client first fetches. This installed binding/core does not expose startup groups/claims or a context setter. The shown groups/claims are fixture reference inputs and are not sent in live mode. Switching users remounts clients with their supported identity configuration. Order evaluation uses a separate actual core instance, so two client requests are intentional. The plugin's mapped navbar may also evaluate independently with its configured build identity; it is not a session-aware authorization boundary.

## What each section teaches

| Section      | Native path / source                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Home         | Live `useToggly().flags`, checklist and missing-key guidance — [index.jsx](src/pages/index.jsx)                                      |
| Declarative  | Native `Feature`, negate, `useFlag`; labelled all/any composition — [NativeGates.jsx](src/components/NativeGates.jsx)                |
| Programmatic | Await native `getFlag` and preserve denied action — [NativeGates.jsx](src/components/NativeGates.jsx)                                |
| Identity     | Immutable client per selected session; provider remount/cleanup — [Root.jsx](src/theme/Root.jsx)                                     |
| Order        | Native core `registerContext`/`getFlag`, late-result guard and polling cleanup — [OrderContext.jsx](src/components/OrderContext.jsx) |
| Filters      | All eleven rows, real provider state and honest HTTP inputs — [FilterMatrix.jsx](src/components/FilterMatrix.jsx)                    |
| Variants     | No native variant assignment/configuration API; keep the existing layout                                                             |
| Docusaurus   | MDX, page/navbar mapping, build/browser/edge boundaries — [beta.mdx](docs/beta.mdx), [docusaurus.config.js](docusaurus.config.js)    |

The [catalog](src/sample/catalog.cjs) holds exact shared names, recorded fixtures and the actual core mapper. It does not reimplement production filters. AlwaysOn and TimeWindow stay on in the recorded nonmatching preset; percentage fixtures are illustrative, not the real sticky algorithm. Browser country/UA/language are real HTTP inputs in live mode, not values a preset button can forge. ContextProperty is evaluated through the core Order check; the React binding cannot carry an entity argument.

## Native capability boundaries

- `Feature` uses `flag`, with `negate`; there is no native FeatureGateBuilder, multi-key or variant component here. Sample all/any and local AND are labelled compositions.
- The core supports canonical entities and `registerContext`. The plugin's React helper omits entity arguments. No other JavaScript SDK singleton substitutes for the core registry.
- The provider owns its polling/WebSocket lifecycle. Views read native context instead of copying its flags. Core has no public refresh subscription, so its view polls and rejects late completions after user/Order changes or unmount.
- Fetch or signature failures preserve cached flags or configured defaults. The native API can absorb errors; absence of `useToggly.error` does not prove a successful fresh request. Browser tests explicitly check cold failure defaults and tampered signatures.
- User identity and claims select presentation, never authorization. Protect real data and actions on the server.

## Build, browser and edge

This runtime-gating site sets `renderAllDuringBuild: true` and `staticGating: false`. Both native Feature branches can exist in static HTML before browser evaluation. This supports complete headings/content, but means disabled browser content is not secret. `x-feature: beta-access` maps the MDX route into plugin manifests and navbar filtering; a hidden link does not deny direct access.

`staticGating` is a separate native build snapshot mode: the build fetches once and bakes values into HTML, requiring a rebuild for changes. It is not the mode this workshop runs. Edge stripping requires a separately deployed worker; no published worker package/private Pages source is copied into this sample. Edge behavior is reference guidance only, with no runnable worker or hosted protection claim.

The core signing dependency includes a Node `crypto` branch. The client-only webpack `resolve.fallback: { crypto: false }` excludes that unused branch; browser WebCrypto still verifies signatures. The production-browser tests accept valid ES256 responses and reject tampering through both native clients. No SDK file or signature check is patched.

## Tests and build

```sh
npx playwright install chromium
npm test
npm run build
npm run serve
```

Linux CI installs Chromium with `npx playwright install --with-deps chromium`. `CHROMIUM_EXECUTABLE=/absolute/path/to/chrome` can select an existing browser locally. Tests use generated ephemeral signing keys and intercepted HTTP/WebSocket transport, never a real service or real App Key. The browser suite builds isolated offline and placeholder-key production sites, walks controls/MDX/mobile layout, verifies signatures/fallbacks, changes remote responses without sample controls and confirms old-session polling stops. Native core tests cover mapper behavior, defaults, identity isolation and cache refresh.

## Manual checklist

- [ ] No key opens offline guidance and safe, usable controls.
- [ ] Your public key/environment/origin loads live signed values.
- [ ] New-dashboard OFF updates Feature, negate, hook and checklist.
- [ ] Remote flag changes update checklist and matrix without clicking controls.
- [ ] Alice/bob requests use the selected identity; old-session polling stops.
- [ ] VIP/standard Orders change core decisions without changing the user.
- [ ] Confirm HTTP reference values versus actual browser-derived targeting.
- [ ] Denied actions stay denied with remote/local prerequisites off.
- [ ] Inspect MDX/native build branches and page/navbar mapping.
- [ ] Check narrow layout and cold network/signature failure defaults.

## Exact manual dashboard recipe

## Create application

1. Workspace: **Toggly Samples**
2. Name: **Docusaurus SDK Sample**
3. Technology: select **Docusaurus** in the picker.
4. Environment: **Production** (default).
5. Allowed Web Origins: add **http://localhost:3000**.

## Context kind: Order

| Property | Type    | Notes                                |
| -------- | ------- | ------------------------------------ |
| `Id`     | string  | Key                                  |
| `Vip`    | boolean | Used by the Express Checkout example |
| `Total`  | number  | Optional                             |

## Demo flags

| Key               | Configuration and use                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `new-dashboard`   | Baseline application/environment toggle with no filter required; switch it on and off for declarative and programmatic demos |
| `api-v2`          | Baseline application/environment toggle with no filter required; switch it on and off for API and multi-key gates            |
| `enhanced-submit` | Baseline application/environment toggle with no filter required; switch it on and off for actions and mutations              |
| `ExpressCheckout` | ContextProperty rule: `Order.Vip = true`; evaluate with `ord-vip` and `ord-standard`                                         |
| `beta-access`     | Baseline application/environment toggle with no filter required; switch it on and off for middleware, edge, and gate routes  |

## Filters category

Create a **Filters** category and these flags:

| Key                       | Filter configuration                       |
| ------------------------- | ------------------------------------------ |
| `filter-always-on`        | AlwaysOn                                   |
| `filter-percentage`       | Percentage, 50% sticky rollout by identity |
| `filter-targeting`        | Targeting, users = `alice`                 |
| `filter-user-claims`      | UserClaims, `role` = `admin`               |
| `filter-time-window`      | TimeWindow, open from 2020 through 2099    |
| `filter-country`          | Country = `US`                             |
| `filter-browser-family`   | BrowserFamily = Chrome                     |
| `filter-browser-language` | BrowserLanguage includes `en`              |
| `filter-device-type`      | DeviceType = Macintosh                     |
| `filter-os`               | OperatingSystem = Mac                      |
| `filter-context-property` | ContextProperty, `Order.Vip` = `true`      |

Configure the flags so the following presets exercise the matrix. These values
match the reference controls in
[`nextjs-server-sdk/components/filter-context-controls.tsx`](../nextjs-server-sdk/components/filter-context-controls.tsx)
and the filter definitions in
[`nextjs-server-sdk/lib/filter-catalog.ts`](../nextjs-server-sdk/lib/filter-catalog.ts).

| Input                    | Matching preset             | Non-matching preset             |
| ------------------------ | --------------------------- | ------------------------------- |
| Identity                 | `alice`                     | `bob`                           |
| Claims                   | `role=admin`                | `role=user`                     |
| Country / `cf-ipcountry` | `US`                        | `CA`                            |
| Accept-Language          | `en-US,en;q=0.9`            | `fr-FR,fr;q=0.9`                |
| User-Agent               | Chrome 120 on macOS 10.15.7 | Firefox 121 on Windows 10       |
| Order                    | `ord-vip` with `Vip=true`   | `ord-standard` with `Vip=false` |

Use these exact User-Agent values when a sample offers reusable presets:

```text
Matching: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Non-matching: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0
```

`filter-always-on` remains on for both presets. `filter-time-window` remains on
while the configured window is open. `filter-percentage` is sticky for an
identity, so its result is not prescribed as matching or non-matching.

After applying the Matching preset, expect targeting, claims, country, browser,
language, device, operating-system, and context-property flags to be on. After
applying the Non-matching preset, expect those flags to be off. If an SDK cannot
evaluate one of these filters, identify that gap in the sample README rather
than reporting a false result.

The live browser cannot synthesize country/User-Agent headers, and this installed client cannot send the reference groups/claims. Configure those rules for learning, but do not expect their offline preset outcomes to be reproducible by the live buttons. The shared [Sample Contract](../docs/SAMPLE_CONTRACT.md) defines the catalog conventions.
