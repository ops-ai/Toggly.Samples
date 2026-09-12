# .NET client SDK showcase

A console and Avalonia desktop application using `Toggly.FeatureManagement.Client.Desktop` **0.1.0**, its portable client dependency **0.1.0**, and Avalonia **11.3.6**. Requires .NET SDK/runtime **8+**. The desktop host runs on macOS, Linux and Windows using Avalonia's native platform requirements; it needs a graphical desktop session.

The two hosts share the same seven-section showcase and real SDK calls. They require no ASP.NET Core app or Generic Host. Feature rollout in an end-user application does not replace backend authorization.

## Quick start

```sh
cd dotnet-client-sdk
dotnet run --project Console
# A graphical desktop session is needed for the following host:
dotnet run --project Desktop
```

With no App Key, both hosts show a visible **OFFLINE** banner and explicit defaults. `new-dashboard` and `enhanced-submit` are on, `api-v2` and unknown keys are off. This mode makes no network requests. It does not prove dashboard setup, connectivity, signatures or targeting.

For live delivery, export the variables described in [.env.example](.env.example) before running. The applications read process environment variables; they do **not** automatically load `.env` files. There is no browser prefix or build-time substitution.

| Variable | Meaning and fallback |
| --- | --- |
| `TOGGLY_APP_KEY` | Public **frontend** App Key; empty selects visible offline defaults |
| `TOGGLY_ENVIRONMENT` | Exact environment name; defaults to `Production` |
| `TOGGLY_SNAPSHOT_DIRECTORY` | Optional current-user cache directory; empty disables disk persistence |

Never distribute backend App Keys, management bearer tokens or private signing keys.

## Toggly application setup

Use application name **.NET Client SDK Sample**, environment **Production**, and the shared [flag template](../docs/FLAG_TEMPLATE.md) and [application setup](../docs/APP_SETUP.md). The existing **C#** technology is backend-oriented; do not assume its default key is valid for a distributed client.

1. In **App Settings**, generate an additional App Key and explicitly choose **Front-end** rather than Backend. Optionally restrict it to Production. Copy only that frontend key into the process environment.
2. Mark all demo flags **Available to Client SDK**. Keep the exact shared flag names. Enable baselines with AlwaysOn; disable them with an empty condition list.
3. Create context **Order**, key property **Id**, boolean **Vip**, optional number **Total**. Bind `ExpressCheckout` and `filter-context-property` to Order and add `Vip = true` ContextProperty conditions.
4. Configure the Filters category from the shared template: targeting user alice, claim role=admin, 50% sticky percentage, time window, and request-derived browser/geographic filters.
5. Native hosts do not have a browser origin. Browser-only origin and header examples from web samples do not simulate geography or a browser in this sample. Follow the platform's frontend key configuration without inventing a .NET client technology picker entry.

## First toggle exercise

1. Start with the live frontend key, then open **Home**. Initialization should complete; inspect **Host lifecycle** for verification or network errors.
2. Turn `new-dashboard` on in Toggly. WebSocket invalidation or **Refresh** fetches the signed response. Home shows true and Declarative gates shows the new dashboard panel.
3. Turn it off. Home shows false, the panel hides, and the negated gate becomes true.
4. Enable `api-v2`: the all-gate requires both flags, while any-gate needs either. This is boolean branching, not experiment assignment.
5. Enable `enhanced-submit`, then toggle the local prerequisite off. The effective flag is false even while the remote flag is true.

A **key** names a feature. A **definition** carries that key's evaluated boolean or entity rule. An **environment** selects a deployment's definitions. **Evaluation** resolves the user-side worker result and any per-read entity/device prerequisites. Initialization attempts a first fetch; defaults keep the UI useful when offline. Refresh updates signed memory state; failures preserve already verified memory values. Missing keys are off unless explicitly defaulted.

## Sections and source map

| Section | What it demonstrates | Source |
| --- | --- | --- |
| Home | Section map, shared flag checklist, current snapshot | `Shared/Showcase.cs`, `Render` |
| Declarative gates | Actual Avalonia visibility, negate, all/any; variant unsupported notice | `Desktop/App.cs`, `Update`; shared rendering |
| Programmatic API | API branch selection, missing flag, local prerequisite | shared `Render` |
| Identity | Matching and Non-matching session presets | `SetPresetAsync` |
| Entity context | VIP/standard Order and missing context | `Order`, shared entity section |
| Filters matrix | Every shared filter and its supported input boundary | `FilterNote` |
| Host lifecycle | Errors, startup, signed memory/cache behavior, refresh and disposal | both host entrypoints |

Read `Showcase` construction first, then `SetPresetAsync`, then `Render`, then the host. Comments at each boundary explain why targeting data is session-scoped and why desktop event consumption uses `Dispatcher.UIThread.Post`.

## Identity, entity and filter boundaries

**Matching** chooses alice, beta group, role=admin, `ord-vip`, Vip=true. **Non-matching** chooses bob, no groups, role=user, `ord-standard`, Vip=false. Context changes immediately clear old flags, then refresh. A client represents this one application's user session; never share its mutable identity across server requests.

The SDK transmits identity/groups/claims to the worker. It evaluates signed EntityGates locally against `EntityContext("Order", orderId, attributes)` at each read. The local entity teaching fixture is explicitly labelled and is not inserted into downloaded flags or a fake signed response. In offline defaults mode, remote `ExpressCheckout` remains off while the separate teaching fixture demonstrates VIP mapping.

| Filters | Preset expectations and limitations |
| --- | --- |
| Targeting / UserClaims | Matching on, Non-matching off after correct live setup |
| ContextProperty | VIP on, standard off with a live EntityGate |
| AlwaysOn | On in both |
| TimeWindow | Worker clock determines result; configured 2020–2099 window stays on |
| Percentage | Sticky by identity, not prescribed on/off per preset |
| Country / BrowserFamily / BrowserLanguage / DeviceType / OperatingSystem | Worker request signals; presets cannot override native geography/browser. Do not expect web browser preset results |
| Variants | This boolean client exposes no experiment assignment API |

All claims are client-supplied rollout input. A feature gate cannot authenticate a user or secure an API.

## Offline cache and lifecycle

The client verifies exact signed bytes and JWK fingerprints before accepting a response. It caches the mixed definition map in memory. File snapshots use context-specific names and retain signed envelopes; the SDK revalidates them when loading.

For cold offline file restoration, a host must configure out-of-band trusted `TrustedJwks`; the sample does not bundle a signing key set. Without trusted keys and connectivity, cold startup uses defaults even if a file exists. Once running, verified in-memory state survives errors. This prevents an untrusted disk cache from choosing its own verification key.

WebSocket JSON notifications and plaintext `update`/`flags-updated` trigger debounced full-context HTTP fetches. These fetches bypass conditional headers and use `rev` when the notification provides it. Routine refreshes can use the last HTTP-confirmed revision; polling remains a fallback. Superseded refreshes are cancelled and drained. **Refresh** explicitly invokes `RefreshAsync`. Console Ctrl+C cancels work; desktop close cancels initialization and awaits disposal. `HttpClient` is disposed after the SDK. Desktop notifications are posted onto the UI thread.

## Checks

```sh
dotnet build Console -c Release
dotnet build Desktop -c Release
dotnet run --project tests/Smoke -c Release
dotnet run --project Console -c Release -- --smoke
# In a graphical desktop session: initialize, render, change context and close.
dotnet run --project Desktop -c Release -- --smoke
```

The smoke executable forces the App Key empty and exercises offline startup, preset changes, local entity fixture, all seven sections and local prerequisites. It does not claim live connectivity. All committed dependencies are NuGet package references; no workspace project references or local feeds are required by these instructions.

Manual checklist:

- Start each host without a key: see OFFLINE and defaults without crashing.
- Supply a frontend key and confirm no errors in Host lifecycle.
- Toggle new-dashboard remotely and observe Home and desktop panel visibility.
- Exercise negate, all, any, unknown key, and local prerequisite.
- Switch Matching/Non-matching and inspect identity plus Order and Filters.
- Disconnect the network after a verified fetch: flags remain and errors are visible.
- Restore connectivity, refresh, and close the host while a request is running.

MIT license. See the [client SDK guide](https://docs.toggly.io/sdks/dotnet-client).
