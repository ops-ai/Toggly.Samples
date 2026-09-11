# .NET SDK workshop

A standalone ASP.NET Core MVC/Razor app for learning feature flags with the
published Toggly Core, Web, Hangfire, HealthChecks and NSwag packages.
Start with [the SDK guide](https://docs.toggly.io/sdks/dotnet), then use this
app to see each decision execute.

## Quick start

Install the stable .NET 10 SDK matching `global.json` (10.0.401 or a newer patch
in that feature band). No database, npm installation or Toggly account is
required for offline practice.

```bash
cd dotnet-sdk
dotnet restore --locked-mode
dotnet test -c Release --no-restore
dotnet run --project src/DotnetSample --urls http://localhost:5000
```

Open [localhost:5000](http://localhost:5000). Missing `TOGGLY_APP_KEY` (or the CI
value `ci-placeholder`) selects **Offline practice**, visibly labelled on every
page. The sample supplies fixture definitions through an HTTP handler; the real
NuGet definition provider, native filters, tag helpers and integrations evaluate
them. This is not evidence of a connection to your Toggly app. Unknown flags
remain OFF, including in Development.

Offline fixture values can be changed before starting the app:

```bash
Sample__DashboardEnabled=false Sample__BetaEnabled=false \
  dotnet run --project src/DotnetSample --urls http://localhost:5000
```

Restart to change offline fixture settings. `Sample__ApiEnabled` and
`Sample__SubmitEnabled` also support true/false. The former demonstrates the
health requirement; the latter controls recurring job registration.

## Connect your dedicated Toggly app

1. Open [app.toggly.io](https://app.toggly.io), use a workspace you can manage (the one from signup is enough), and
   create **.NET SDK Sample**. Select **C#** (the .NET SDK technology) in the technology picker.
2. Use the **Production** environment (case-sensitive). Set **Application URL**
   to `http://localhost:5000`; add that origin under **Allowed Web Origins** only
   if the existing client-side section is present. Server-only evaluations do
   not use browser CORS. Follow the [shared setup guide](../docs/APP_SETUP.md)
   for the context, conditions, and final save controls.
3. Create context kind **Order**: `Id` string/key, `Vip` boolean, `Total` number
   (optional). The app registers this type locally via `AddTogglyEntityContext`.
   Live startup also attempts schema registration; failures do not stop the app.
4. Add these environment toggles: `new-dashboard`, `api-v2`, `enhanced-submit`,
   `beta-access`. Enable them initially, with no user filters. Add
   `ExpressCheckout` with ContextProperty `Order.Vip = true`.
5. Create the **Filters** category and all eleven flags from
   [the shared flag template](../docs/FLAG_TEMPLATE.md). Exact settings and
   presets are repeated below. Set segment percentages to 100%; Percentage is
   the separate sticky 50% row.
6. Optional named-variant exercise on `new-dashboard`: add `classic` with JSON
   configuration `{"title":"Classic dashboard"}` and `preview` with
   `{"title":"Preview dashboard"}`. Default enabled/disabled allocation is
   `classic`; assign user `alice` to `preview`. Without variants, the sample
   displays "none configured" and a classic/unallocated fallback.
7. Copy the application's **Backend** app key into your local shell environment.
   Do not use a frontend key or commit the value. ASP.NET Core does not read
   `.env.example` automatically. It documents the names; either export them or
   copy it to ignored `.env.local`, edit locally, then source it:

```bash
cp .env.example .env.local
# Edit .env.local locally: put your Backend key in TOGGLY_APP_KEY.
set -a
source .env.local
set +a
dotnet run --project src/DotnetSample
```

The application uses signed definitions in live mode. It shares one provider
and cached definitions across requests; identity and entity data remain scoped
to each request/evaluation. A configured key is not proof of successful loading:
check the Home "definitions loaded" state and server logs.

App provisioning is a manual step for this checkout. The sample includes no
real keys and does not claim that a live app has already been created.

## Your first flag, step by step

1. Visit `/gates`. The new dashboard content renders when `new-dashboard` is ON.
2. In your Toggly app, switch that flag OFF in Production.
3. Refresh Home and `/gates` after the SDK receives the update. The snapshot
   becomes OFF and the negate fallback appears. No application deployment is
   required. Switch it ON and repeat.
4. Visit `/api/multi`. It requires both `new-dashboard` and `api-v2`; a disabled
   gate returns HTTP 404, even if you type the URL directly.
5. In offline practice, repeat with `Sample__DashboardEnabled=false` and restart.
   Do not expect a dashboard change to alter offline fixtures.

Server-rendered pages show the SDK state at request time. They do not maintain a
second browser cache or automatically refresh. In live mode the native provider
receives WebSocket notifications, falls back to five-minute polling, and keeps a
reduced twenty-minute safety poll while connected. Failed refreshes can retain
last-good definitions. Missing initial definitions and undefined keys stay OFF.

## Sections

| Path | Learn / execute | Native package surface |
|---|---|---|
| `/` | Section map, required-key checklist, request snapshot and setup banner | Definition provider, `IFeatureManager` |
| `/gates` | Feature/negate, All/Any, named variant and entity gates | Toggly Razor `FeatureTagHelper`, `IVariantFeatureManager` |
| `/programmatic` | C# checks, request snapshot, defaults and API gates | `IFeatureManager`, `IFeatureManagerSnapshot`, MVC `FeatureGate` |
| `/identity` | Set/clear demo preference, user/claims and sticky targeting | `WithTogglyTargeting`, request accessor |
| `/orders` | VIP/standard, omitted and unregistered contexts | `AddTogglyEntityContext`, per-instance checks |
| `/filters` | All eleven rows with Matching/Non-matching presets | Core filters and Web HTTP filters |
| `/integrations` | Actual job registration, health and OpenAPI | Hangfire, HealthChecks, NSwag packages |
| `/api/snapshot` | JSON for this request; no key/secret diagnostics | Sample endpoint around native evaluations |
| `/api/beta`, `/api/multi`, `/api/data` | Gated endpoints / response version | MVC gates, snapshot check |
| `/health/toggly` | Definition readiness and required `api-v2` | Native health check |
| `/swagger/v1/swagger.json` | OpenAPI excludes disabled gated paths | Feature-aware native middleware |

Every HTML page includes the missing-key banner. JSON/health endpoints return
their native content types instead of HTML banners.

## Read the source in this order

1. [`Program.cs`](src/DotnetSample/Program.cs): one shared definition cache,
   request targeting registration, entity schema and native integrations.
2. [`SamplePersonas.cs`](src/DotnetSample/Features/SamplePersonas.cs): preset
   middleware and stateless request accessor. All known targeting exists before
   the first evaluation. There is no init-then-set-context request pair.
3. [`Gates.cshtml`](src/DotnetSample/Views/Showcase/Gates.cshtml) and
   [`_ViewImports.cshtml`](src/DotnetSample/Views/_ViewImports.cshtml): native
   feature/negate/All/Any/entity syntax. Register the Toggly helper and remove
   Microsoft's overlapping helper when both are imported.
4. [`ShowcaseController.cs`](src/DotnetSample/Controllers/ShowcaseController.cs):
   Boolean and variant queries, Order checks and safe diagnostic selection.
5. [`GatedApiController.cs`](src/DotnetSample/Controllers/GatedApiController.cs):
   enforcement at the endpoint, rather than only hiding UI.
6. [`OfflineDefinitions.cs`](src/DotnetSample/Features/OfflineDefinitions.cs) and
   [`OfflineTransport.cs`](src/DotnetSample/Features/OfflineTransport.cs): sample
   fixture data/transport, clearly separate from the live integration.
7. [`ShowcaseTests.cs`](tests/DotnetSample.Tests/ShowcaseTests.cs) and
   [`SignedRefreshTests.cs`](tests/DotnetSample.Tests/SignedRefreshTests.cs):
   real published-package behavior, concurrent users and native signed refresh.

## User identity versus entity context

A user identifies **who** is evaluating; Order identifies **what** is being
considered. `RequestTargetingAccessor` stores no mutable identity. It reads the
asynchronous `IHttpContextAccessor`, so overlapping Alice/Bob requests do not
change each other's decisions. Query presets override only that request; the
cookie remembers a sample preference. Clearing it removes the cookie; subsequent visits stay anonymous until you choose
a persona.

The demo principal, role, country and UA are simulated from public controls.
**This is not authentication.** Replace `SamplePersonas.Apply` with validated
authentication claims and trusted proxy/browser data in your application. Feature
flags are not a replacement for authorization.

The entity example passes a registered `Order` to `IsEnabledAsync` and the Razor
helper. It evaluates user filters first when present, then the Order filter.
Omitting the entity or passing an unregistered anonymous object fails closed.
Use the non-snapshot `IFeatureManager` when evaluating multiple Order instances;
a Boolean request snapshot must not accidentally reuse one entity's decision.

The native Toggly tag helper has no variant attribute. Variant selection is
native `IVariantFeatureManager.GetVariantAsync`; the view's `if` statement is
ordinary sample composition around the selected name/configuration. Variant
allocation is separate from Boolean enablement and can define a disabled
fallback. A feature flag need not have variants at all.

## Filters and exact presets

| Flag | Dashboard configuration | Matching / Non-matching |
|---|---|---|
| `filter-always-on` | AlwaysOn | ON / ON |
| `filter-percentage` | Percentage 50% | Sticky by identity; either result is valid |
| `filter-targeting` | Targeting users: alice | ON / OFF |
| `filter-user-claims` | UserClaims role=admin, Percentage 100 | ON / OFF |
| `filter-time-window` | TimeWindow 2020-01-01 through 2099-12-31 | ON / ON while open |
| `filter-country` | Country US, Percentage 100 | ON / OFF |
| `filter-browser-family` | BrowserFamily Chrome, Percentage 100 | ON / OFF |
| `filter-browser-language` | BrowserLanguage en, Percentage 100 | ON / OFF |
| `filter-device-type` | DeviceType Macintosh, Percentage 100 | **OFF / OFF: native parser/template gap** |
| `filter-os` | OperatingSystem Mac, Percentage 100 | ON / OFF |
| `filter-context-property` | ContextProperty Order.Vip=true | ON / OFF |

Matching uses `alice`, `role=admin`, group `beta-testers`, country `US`,
`en-US,en;q=0.9`, and Order `ord-vip` (`Vip=true`, Total=249). Non-matching uses
`bob`, `role=user`, no groups, country `CA`, `fr-FR,fr;q=0.9`, and `ord-standard`
(`Vip=false`, Total=49).

```text
Matching UA: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Non-matching UA: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0
```

The installed .NET UA parser returns device family **Mac**, while the shared
catalog rule says **Macintosh**. The native DeviceType filter therefore returns
OFF even for Matching. This sample preserves the shared rule and shows that
actual result instead of claiming parity. The OS filter separately matches Mac
and works. To explore a .NET-specific device rule in your own app, match Mac;
that differs from this catalog's shared template.

The actual .NET filter aliases in definitions are `CountryFamily` and `OS`.
Core uses `Microsoft.Percentage`, `Microsoft.Targeting`, `Microsoft.TimeWindow`.
These names and the flattened parameters are shown in `OfflineDefinitions.cs`.
The dashboard's friendly names and the local filter aliases are different.

## Native integration details

- **Hangfire:** `AddOrUpdateJob` subscribes to environment-level AlwaysOn state.
  It registers/removes `enhanced-submit-practice` using the real DI
  `IRecurringJobManager`. A real worker logs a timestamp each minute. This
  harmless in-memory job is lost on restart; use durable storage in deployed
  applications. User-targeted flag evaluations do not schedule global jobs.
- **HealthChecks:** `/health/toggly` checks loading/freshness and requires
  `api-v2` to have AlwaysOn. Healthy offline fixtures do not establish a live
  connection. WebSocket disconnection alone is informational; stale definitions
  plus disconnection fail the check. Disabled required flags report Degraded.
- **NSwag:** use `UseFeatureAwareOpenApi` after request-context middleware, with
  `AddFeatureGateFiltering`. A fresh document removes disabled gated endpoints;
  the endpoint itself remains protected by `FeatureGate`. Avoid substituting
  NSwag's normally cached `UseOpenApi` middleware for this demonstration.

Offline HttpClient traffic, including telemetry, is intercepted locally. The
SDK's independent WebSocket can log loopback connection failures on port 1;
it never contacts Toggly in this mode. Live mode uses the SDK's normal transport
and signature verification. Keep app keys out of browser HTML, JSON and logs.

## Versions

Registry checkpoint: 2026-09-10. Exact NuGet resolution is committed in both
`packages.lock.json` files.

| Dependency | Version |
|---|---|
| .NET SDK / ASP.NET Core runtime | 10.0.401 / 10.0.12 |
| Toggly.FeatureManagement | 3.6.6 |
| Toggly.FeatureManagement.Web | 3.6.6 |
| Toggly.FeatureManagement.Hangfire | 3.6.6 |
| Toggly.FeatureManagement.HealthChecks | 3.6.6 |
| Toggly.FeatureManagement.NSwag | 3.6.6 |
| Hangfire.AspNetCore | 1.8.25 |
| Hangfire.InMemory | 1.0.0 |
| NSwag.AspNetCore | 14.7.1 |
| Microsoft.AspNetCore.Mvc.Testing | 10.0.12 |
| Microsoft.NET.Test.Sdk / xUnit / VS runner | 18.10.0 / 2.9.3 / 4.0.0 |

## Verification and production build

```bash
dotnet restore --locked-mode
dotnet test -c Release --no-restore
dotnet publish src/DotnetSample -c Release --no-restore -o artifacts/publish
(cd artifacts/publish && TOGGLY_APP_KEY=ci-placeholder ASPNETCORE_URLS=http://localhost:5000 \
  dotnet DotnetSample.dll)
```

The tests use real NuGet services, actual MVC/Razor requests and native
Hangfire/health/OpenAPI behavior. Signed-refresh tests create an ephemeral
in-memory signing key and a local WebSocket feed; they verify valid updates,
tamper rejection, last-good retention, cold failure and gate/job/document
changes. No Toggly account or external database is required. Test hosts run
sequentially because Hangfire has process-wide infrastructure; a separate test
issues 32 overlapping requests to verify user/Order isolation.

CI runs these commands with a placeholder key and a real published-app HTTP
smoke. Hosted and local fixture tests do not replace the manual live checklist.

## Manual checklist

- [ ] Start with no key. Every HTML page shows Offline practice, all sections
      load, and no real keys or `.env.local` files appear in git status.
- [ ] Home shows all five demo flags, all eleven filter flags and current
      loaded/check/socket state. It never prints the configured app key.
- [ ] Toggle `new-dashboard` offline with the startup setting, then live in the
      dashboard. Feature/negate branches swap; All hides and Any remains if
      `api-v2` stays ON. The page changes on the next request.
- [ ] Named variant: Alice selects preview and Bob classic when configured.
      With no variants, "none configured" is displayed honestly.
- [ ] Set Alice/Bob on Identity, reload and open two query-preset tabs. Clear the
      preference. No visitor changes another request's targeting or Order.
- [ ] VIP Order enables ExpressCheckout; standard, missing and unregistered
      contexts do not. The Razor entity gate agrees with the programmatic result.
- [ ] Filters Matching and Non-matching match the table above. DeviceType is
      explicitly OFF for both because Mac differs from Macintosh. AlwaysOn and
      the open time window stay ON; Percentage remains sticky for each identity.
- [ ] `/api/beta` returns 200/404 when beta-access changes. `/api/multi` requires
      both keys. `/api/data` selects the response version from api-v2.
- [ ] Turn enhanced-submit off/on globally: the recurring Hangfire job disappears/
      returns. Leave it enabled for a minute and observe its timestamp server log.
- [ ] Health reports Healthy for fresh definitions and the required api-v2 ON;
      disabling the required flag reports Degraded. No raw diagnostic keys leak.
- [ ] OpenAPI excludes/includes `/api/beta` after the flag changes, matching its
      real endpoint behavior. Refreshing does not reuse a stale document.
- [ ] Disconnect the live network after loading definitions: last-good results
      remain available. Reconnect and change a flag; the next request reflects
      the refreshed definitions. Check failures in server logs.
- [ ] Walk every section at mobile width and using keyboard navigation.
