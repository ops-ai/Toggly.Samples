# Electron SDK Sample

A beginner-oriented Electron 44 + React 19 desktop application using published
[`@ops-ai/electron-feature-flags-toggly` 1.1.0](https://www.npmjs.com/package/@ops-ai/electron-feature-flags-toggly).
It pins Electron 44.3.0, electron-vite 5.0.0, React 19.3.0, Vite React plugin
5.2.0, TypeScript 7.0.2, Vitest 5.0.0, and dotenv 17.4.2. These were checked
against npm on 2026-09-12. Run with Node 22.12+; CI uses Node 24.

A **feature flag** is a named decision in an app. Its rule can make
`new-dashboard` ON for one rollout and OFF for another without rebuilding the
desktop app. An **App Key** selects public definitions for one Toggly app; it
is not a management API credential. A presentation gate is not authorization.

## First toggle: follow a decision safely

```sh
cd electron-sdk
npm ci
npm run dev
```

Without an App Key, the window opens with an explicit banner and safe OFF
defaults. No definitions request is made. After completing the recipe below,
copy `.env.example` to ignored `.env.local`, add your own App Key and restart.
Switch `new-dashboard` ON in Toggly to show Dashboard v2; switch it OFF to
return to the classic branch.

Read the sample in this order:

| File | What it teaches |
| --- | --- |
| [src/main/index.ts](src/main/index.ts) | Main-only configuration, startup, signed definitions, cache, IPC and secure window settings. |
| [src/preload/index.ts](src/preload/index.ts) | `contextBridge` exposure without Node, generic IPC, or the App Key. |
| [src/renderer/App.tsx](src/renderer/App.tsx) | React gates, programmatic checks, desktop identity, Order data, filters and failures. |
| [src/renderer/demo-model.ts](src/renderer/demo-model.ts) | Shared names, Order schema, presets and documented SDK limitations. |
| [test/](test/) | Offline checks for teaching data and Electron Vite output paths. |

## Security and process map

```text
.env.local -> Electron main -> Toggly init, signed definitions, disk cache
                                 |
                                 +-> documented SDK IPC -> preload contextBridge -> React
                                 +-> refreshed snapshots -> every BrowserWindow
```

Main owns the key. `contextIsolation: true` and `nodeIntegration: false` keep
Node out of page code. `exposeToggly()` permits feature decisions,
snapshots, explicit session updates, telemetry events and update subscriptions;
do not expose a
generic IPC channel or the App Key.

## Contract sections

| Contract | Page | Behavior |
| --- | --- | --- |
| Home | Home | Map, checklist, snapshot and first toggle. |
| Declarative | Declarative | React `Feature`, negate and all/any gates. |
| Programmatic | Programmatic | `isFeatureOn` and `evaluateFeatureGate`. |
| Identity | Identity | Explicit session context and clear lifecycle. |
| Entity | Entity | `Order` with `Vip` for `ExpressCheckout`. |
| Filters | Filters | Matching/non-matching controls and capability matrix. |
| Electron-specific | Electron | Main/preload/renderer boundary, cache, signatures and updates. |
| Missing app key | Banner / Configuration | Navigable defaults and no network call. |

## What the SDK does

The SDK initializes once in Electron **main**, persists last-known-good
evaluated definitions under `app.getPath('userData')`, optionally verifies
ES256 signatures, and enables live updates when an App Key is present. Its IPC
registration fans refreshed snapshots out to open BrowserWindows. React
`Feature`, `useFeatureFlag`, and `useFeatureGate` re-evaluate the UI.

`setContext({ identity, groups, claims })` changes the long-lived main-process
singleton and refreshes definitions. Use it only for an explicit desktop
account sign-in/out lifecycle; do not let untrusted page input choose an
identity. Call `clearContext()` at sign-out. Stable identities make percentage
rollouts stable for that identity.

For `ExpressCheckout`, this sample sends the published entity object
`{ kind: 'Order', key: 'ord-vip', attributes: { Id, Vip, Total } }` only to
that evaluation. It does not change the desktop identity to inspect an order.
Electron SDK 1.1.0 publishes boolean flags and
all/any/negate gates, but no named-variant or experiment-assignment API. The
dashboard labels are boolean UI branches, not A/B assignments.

## Main-owned telemetry

With a configured App Key, SDK 1.1.0 automatically counts effective feature
checks made by direct, gate, and committed React paths. The Electron section
demonstrates explicit `recordUsage`, `recordView`, `incrementCounter`,
`setGauge`, and `flushTelemetry` through the validated preload bridge. Main
owns one reporter shared across windows; the renderer receives neither the
App Key nor a transport configuration. Set `TOGGLY_DISABLE_TELEMETRY=true`
in main to opt out. Missing-key mode also disables reporting. Event variants
label usage or views, not named flag assignments.

Main attaches the SDK lifecycle hook for window blur, last-window close,
suspend, and app quit. The public host test runs a real hidden BrowserWindow
with bundled preload after a clean registry install. It intercepts definitions
and telemetry, captures a compact gzipped packet, and checks keyless, opt-out,
validated IPC, React, and explicit API paths without a production POST. The
observed packet contains an anonymous `u` field; acceptance of that optional
wire field is tracked separately from this sample verification.

## Create the Toggly application manually

Dashboard provisioning could not be completed in this delivery: no Electron
app, key, flags, contexts, or origins were created. Do not commit a real key.

1. In [app.toggly.io](https://app.toggly.io), create **Electron SDK Sample** in
   **Toggly Samples**. Select **Electron** and create/select environment
   **Production**.
2. Set local Application URL to `http://localhost:5173`. The renderer uses
   trusted main-process IPC for flag transport, so it does not need an Allowed
   Web Origin. If that control is shown, add `http://localhost:5173` only for
   the developer UI.
3. Create context kind **Order**: `Id` string key, `Vip` boolean, `Total`
   number. Use `ord-vip`/true/199 and `ord-standard`/false/49. Bind
   `ExpressCheckout` and `filter-context-property` to Order.
4. Create baseline flags `new-dashboard`, `api-v2`, `enhanced-submit`,
   `ExpressCheckout`, and `beta-access`. Configure `ExpressCheckout` as
   ContextProperty `Order.Vip = true`.
5. Create the Filters category and all eleven rules in
   [FLAG_TEMPLATE](../docs/FLAG_TEMPLATE.md): AlwaysOn, 50% Percentage,
   Targeting alice, UserClaims role=admin, TimeWindow, Country US,
   BrowserFamily Chrome, BrowserLanguage en, DeviceType Macintosh,
   OperatingSystem Mac, and ContextProperty `Order.Vip=true`.
6. Put the App Key only in ignored `.env.local`, restart, and complete the
   checklist. See [APP_SETUP](../docs/APP_SETUP.md) for picker/API details.

## Filter capability matrix

Matching sends `alice`, `role=admin`, and a VIP Order. Non-matching sends
`bob`, `role=user`, and a standard Order. The full template inputs are visible
in the UI to keep configuration consistent.

| Filter | Matching / non-matching | Electron 1.1.0 |
| --- | --- | --- |
| AlwaysOn, Percentage, Targeting, UserClaims, TimeWindow | Template values | Supported. Percentage is sticky and has no prescribed result. |
| ContextProperty | VIP / standard Order | Supported per evaluation. |
| Country | US / CA | Not exposed by the Electron bridge. |
| BrowserFamily | Chrome / Firefox | Not exposed by the Electron bridge. |
| BrowserLanguage | English / French | Not exposed by the Electron bridge. |
| DeviceType | Macintosh / Windows | Not exposed by the Electron bridge. |
| OperatingSystem | Mac / Windows | Not exposed by the Electron bridge. |

The bridge publishes identity, groups, claims and entity context. It does not
accept HTTP request metadata. The sample labels those header-derived results
“Not evaluated by this bridge” instead of faking them.

## Commands

```sh
cd electron-sdk
npm ci
npm test
npm run build
npm run test:public-host

# Retained maintainer compatibility contract, separate from public proof.
TOGGLY_ELECTRON_SDK_TARBALL=/absolute/path/to/ops-ai-electron-feature-flags-toggly-1.1.0.tgz npm run test:packed-hosts
npm run dev
```

`test:public-host` uses the public 1.1.0 package recorded in the registry
lockfile. `test:packed-hosts` installs the supplied packed candidate into disposable
Electron 28.3.3 and 44.3.0 hosts. It runs the built main, custom compiled
preload, context-isolated renderer IPC bridge, and React hooks/components in
an actual hidden Electron window. On Linux it requires a display server such
as Xvfb. The candidate tarball is neither committed nor substituted with an
SDK source path or an unpublished registry version.

CI also uses a synthetic main-only key for the intercepted host contract.
It does not prove live dashboard setup, connectivity, signatures, or cache
behavior.

## Manual checklist

- [ ] Without a key, see the banner, OFF defaults, and no network request.
- [ ] With a key, toggle `new-dashboard` and observe both UI branches.
- [ ] Visit every section and observe snapshot updates after a flag refresh.
- [ ] Apply both presets: targeting/claims and `ExpressCheckout` follow their
  supported inputs; header rows remain honestly unavailable.
- [ ] Apply a desktop account identity and clear it on sign-out.
- [ ] On macOS, close every window, activate the app again, and confirm a new
  window opens with the existing flag session. Main-process Toggly/IPC setup
  occurs once; reopening a window does not register duplicate IPC handlers.
- [ ] Restart offline after a successful load and check last-known-good cache;
  then remove the key and check defaults.
- [ ] Inspect DevTools: the App Key never appears in renderer code and
  `window.toggly` remains the only Toggly capability.

Read the [Electron SDK documentation](https://docs.toggly.io/sdks/electron)
for API details and the [Samples catalog](../README.md) for related examples.
