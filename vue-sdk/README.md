# Vue SDK workshop

A standalone Vue 3 + Vite application showing how a feature flag reaches a template, a button, a composable and an Order-specific decision. It uses the published `@ops-ai/vue-feature-flags-toggly` package, including its native `Feature` / `FeatureGateBuilder` components, service and composables.

## Run it

Use Node **22.23.2+** and npm **11**. The current Vite host requires a recent Node version; npm 11 also avoids an older npm resolver failure with the test-tool dependencies.

```sh
cd vue-sdk
npm install -g npm@11
npm ci
npm run dev
```

Open **http://localhost:5173**. With no App Key, the prominent **OFFLINE FIXTURES** banner explains that the sample feeds deterministic payloads through the real SDK. Nothing is sent to a real Toggly app in this mode. You do not need an account to learn the controls.

Installed host/package versions: Vue **3.5.42**, Vite **8.2.2**, Toggly Vue SDK **1.9.5**. `package-lock.json` records the full dependency set. This sample uses the official Vite **JavaScript** Vue template.

## Your first flag, in three minutes

1. Find `new-dashboard` in the flag checklist. It starts **ON** in offline mode.
2. Switch it off. The native `Feature` component removes “New dashboard visible”; the negated component shows “Existing dashboard visible”. The single-flag composable also changes to OFF.
3. Leave `api-v2` on. The **all** gate is denied, but the **any** gate still shows its content. This is why a multi-key requirement matters.
4. Switch `new-dashboard` on again. Pick **Non-matching · bob**. Targeting/claims fixtures turn off and the variant changes to `comfortable`. AlwaysOn and the open TimeWindow stay on.
5. Keep bob selected and choose **VIP Order**. Express Checkout becomes available for that Order without changing the user's identity.
6. Turn the device prerequisite off. Enhanced submit becomes disabled even when its remote flag is on. A local gate only restricts a remote result; it cannot enable a remotely disabled feature.

These controls do not modify your dashboard. Offline HTTP filter outcomes are recorded examples, not a replacement implementation of the production filter engine. The illustrative percentage fixture is not the production sticky-bucketing algorithm.

## Connect your Toggly application

```sh
cp .env.example .env.local
# Edit .env.local, then restart npm run dev.
```

Set `VITE_TOGGLY_APP_KEY` to the public **App Key** from your application, and `VITE_TOGGLY_ENVIRONMENT=Production`. Vite exposes `VITE_` variables to browser code at build/start time; they are visible to anyone who loads the app. Never use a management API key or private credential here. `.env.local` is ignored by Git.

A nonempty App Key selects **LIVE SDK** mode. Offline switches and error simulation are disabled. Change flags in Toggly instead. Known identity, groups and claims are supplied before the first evaluation. Live responses require signature verification, and errors leave safe defaults visible. The two SDK instances request evaluated flags and evaluated variants separately; one request per client is intentional.

### Exact dashboard setup

1. Sign in at [app.toggly.io](https://app.toggly.io). Use a workspace you can manage (the one from signup is enough). Create **Vue SDK Sample**.
2. Select **Vue** technology, use environment **Production**, and allow web origin **http://localhost:5173**.
3. Add context kind **Order** with key property **Id** (string), **Vip** (boolean), and optional **Total** (number). The browser registers a local mapper only; create the schema in the dashboard.
4. Add these flags:

| Flag              | Setup / exercise                                                                                                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new-dashboard`   | Enable/disable the new UI. For the variants exercise, add `compact` and `comfortable` variants with configuration `{ "density": "compact" }` / `{ "density": "comfortable" }` and your chosen assignment rules. Live assignment follows those rules, not the offline preset. |
| `api-v2`          | Baseline on/off toggle for multi-key gates                                                                                                                                                                                                                                   |
| `enhanced-submit` | Baseline on/off toggle for the action and device-local gate                                                                                                                                                                                                                  |
| `ExpressCheckout` | ContextProperty: `Order.Vip = true`                                                                                                                                                                                                                                          |
| `beta-access`     | Baseline on/off toggle for the navigation composition                                                                                                                                                                                                                        |

5. Create a **Filters** category and the following flags. Use the same exact names in the app and dashboard:

| Key                       | Filter / rule                           |
| ------------------------- | --------------------------------------- |
| `filter-always-on`        | AlwaysOn                                |
| `filter-percentage`       | Percentage: 50%, sticky by identity     |
| `filter-targeting`        | Targeting: users = `alice`              |
| `filter-user-claims`      | UserClaims: `role = admin`              |
| `filter-time-window`      | TimeWindow: open from 2020 through 2099 |
| `filter-country`          | Country: US                             |
| `filter-browser-family`   | BrowserFamily: Chrome                   |
| `filter-browser-language` | BrowserLanguage: en                     |
| `filter-device-type`      | DeviceType: Macintosh                   |
| `filter-os`               | OperatingSystem: Mac                    |
| `filter-context-property` | ContextProperty: `Order.Vip = true`     |

Matching user: `alice`, groups `beta`, claim `role=admin`. Non-matching user: `bob`, no groups, claim `role=user`. Orders are `ord-vip` / `Vip=true` / `Total=240` and `ord-standard` / `Vip=false` / `Total=60`.

The HTTP reference presets are US + `en-US,en;q=0.9` + Chrome on macOS versus CA + `fr-FR,fr;q=0.9` + Firefox on Windows. Exact User-Agent strings live in [`src/sample/catalog.js`](src/sample/catalog.js) and the shared [`FLAG_TEMPLATE.md`](../docs/FLAG_TEMPLATE.md). **Macintosh is the device value; Mac is the operating system.** Live country/user-agent/language derive from the real browser request and service, so selecting a preset does not forge those values. AlwaysOn stays on, TimeWindow stays on during its configured interval, and the percentage outcome is not guaranteed by the labels “Matching” or “Non-matching”.

## Sections and source-reading map

| Section        | What to learn                                                                  | Read next                                                                           |
| -------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Home           | Checklist, current SDK snapshot, first flag and missing-key guidance           | [`src/App.vue`](src/App.vue)                                                        |
| Template gates | Native Feature, negate, all/any, builder slot and reactive composables         | [`src/components/TemplateGates.vue`](src/components/TemplateGates.vue)              |
| Programmatic   | Await the service before branching; keep a denied fallback                     | [`src/components/Actions.vue`](src/components/Actions.vue)                          |
| Identity       | Complete startup context; later `setContext` refreshes                         | [`src/sample/workshop.js`](src/sample/workshop.js)                                  |
| Order          | Mapper and per-check entity, independent from user targeting                   | [`src/sample/catalog.js`](src/sample/catalog.js) and `src/components/OrderGate.vue` |
| Filters        | Eleven rows; recorded fixtures versus real request inputs                      | [`src/components/FilterMatrix.vue`](src/components/FilterMatrix.vue)                |
| Variants       | Native useVariant and configuration fallback                                   | `src/components/Variants.vue` and `workshop.js`                                     |
| Vue surfaces   | Plugin/injection, builder, local-gate notifications and navigation composition | [`src/main.js`](src/main.js) and `Actions.vue`                                      |

`workshop.js` contains orchestration; components do not reconstruct the SDK's evaluation rules. `offline.js` intercepts only a reserved `.invalid` origin, returning unsigned demo payloads. This transport is installed only when no key is configured. The real SDK still evaluates the native UI, local gates and entity rules.

### Important API distinctions

- Install `toggly` with `app.use`. It globally registers `Feature` and `FeatureGateBuilder`, and provides `$toggly`. The exported `togglyService` is the plugin's browser singleton. This SPA changes its own session context; do not reuse it as mutable request state on a server.
- Call `useFeatureFlag`, `useFeatureGate` and `useVariant` inside setup. Keep their refs so refresh notifications remain reactive. The package does not export `createToggly` or `useToggly`.
- `setContext` performs the fetch; do not add a second refresh. Changing the selected Order needs no user-context fetch.
- The evaluated-variants payload contains enabled/variant/configuration assignments, while the evaluated flags payload can contain EntityGates. This sample uses two real service instances so it does not treat a flattened boolean variant snapshot as an entity rule.
- The Vue SDK has no native Vue Router guard export. The navigation button is a labelled composition of `isFeatureOn`, not an invented SDK guard.
- Browser flags and user claims select presentation. They are **not authorization**. Servers must authorize every protected action independently.

## Tests and production build

```sh
npx playwright install chromium
npm test
npm run build
npm run preview
```

On Linux CI, use `npx playwright install --with-deps chromium`. For an existing local Chromium installation, set `CHROMIUM_EXECUTABLE=/absolute/path/to/chrome`.

- Unit/component tests mount the actual published plugin and native components/composables. They cover missing-key mode, defaults, negate/all/any, denied actions, identity fetch counts, entity values, local gates, variants and recovery.
- Headless browser tests walk offline controls at desktop/mobile widths, then feed generated signed responses through a production build of the real browser SDK. They verify initial targeting and reject a tampered signed ON payload. The signing keys exist in test memory only, and all test HTTP/WebSocket transport is isolated from real Toggly services.
- Production builds retain the SDK's browser signature path. Vite may report that Node `crypto` was externalized in the shared dependency; browser verification is covered by the signed-response test.

## Manual checklist

- [ ] Missing key opens offline mode with visible guidance and no real Toggly requests.
- [ ] Live key/environment/origin selects live mode, then your real flags appear.
- [ ] Toggle new-dashboard off/on; verify both native and composable fallback paths.
- [ ] Change user; inspect the evaluated request context and confirm one refresh per client.
- [ ] Select VIP/standard Order without changing identity; check ExpressCheckout.
- [ ] Compare every filter row and distinguish reference HTTP inputs from real ones.
- [ ] Confirm the variant name/configuration you assigned in the dashboard.
- [ ] Deny enhanced-submit remotely and locally; a local gate must never enable it.
- [ ] Deny beta-access; the existing view remains available.
- [ ] Simulate a transport error offline, recover, and repeat on a narrow screen.

The shared [Sample Contract](../docs/SAMPLE_CONTRACT.md) and [flag template](../docs/FLAG_TEMPLATE.md) describe the catalog conventions.
