# .NET embedded dashboard workshop

A complete ASP.NET Core application with the **published Toggly 3.7.0 dashboard**
mounted at `/internal/features`, SQLite persistence, and seven Razor workshop
pages. No Toggly account, app key, internet connection at runtime, frontend build,
or external service is required. NuGet restore needs internet access.

This is a real embedded runtime, not a cloud SDK running against mocked endpoints.
The sample begins with **no catalog and all flags OFF**. You explicitly initialize
or import your definitions through the packaged dashboard.

## Quick start

Install the .NET 10 SDK (10.0.400 or a later stable feature band). From this folder:

```bash
dotnet restore --locked-mode
dotnet run --project src/EmbeddedDashboardSample --framework net10.0 --urls http://127.0.0.1:5080
```

Open [the workshop](http://127.0.0.1:5080) and
[the dashboard](http://127.0.0.1:5080/internal/features). The server-rendered UI
uses bundled assets and system fonts. There is no Node installation step.

The project also targets .NET 8. Install its runtime and use `--framework net8.0`
to run it; the repository's .NET 10 SDK builds both targets. Always run from this
folder to keep the relative SQLite path stable. `toggly.sample.db` and its SQLite
sidecars are ignored by Git.

### First toggle

1. Open the dashboard and **Initialize catalog**.
2. Create a feature named **New dashboard**, key **`new-dashboard`**. New features
   start disabled. A key is the stable identifier referenced by your code.
3. Visit [Declarative gates](http://127.0.0.1:5080/gates). Expect the classic fallback.
4. Enable `new-dashboard` in the dashboard, then refresh the gates page. Expect
   “New dashboard is available” and no classic branch in the response HTML.
5. Turn it off and refresh. The fallback returns, without a rebuild or restart.

### Load the full workshop

Open dashboard **Import/Export**, upload [`example-catalog.json`](example-catalog.json),
and inspect the preview. It contains the shared 16 workshop flags and an `Order`
context schema. Preview performs no write. Apply the selected additions.

Import can initialize an absent catalog directly. If you already created
`new-dashboard`, the preview skips the existing key until you explicitly select
its replacement. Imports merge; they do not delete target features absent from
the file. Keep the default skip selection for any edits you want to retain.

The portable catalog uses `Production`, enabled state separate from retained
rules, and SDK-compatible flattened parameter names. Enabled features without
rules compile to `AlwaysOn`; disabled features evaluate false while retaining
rules for later re-enablement. Unknown features also evaluate false.

## Sections

| Page | What to try |
|---|---|
| `/` | First-toggle guide, actual evaluated flag checklist, storage state |
| `/gates` | Native `<feature>` helper, negate, Any/All multi-key gates and entity context |
| `/programmatic` | `IFeatureManager.IsEnabledAsync`, API branch, native MVC `[FeatureGate]` |
| `/identity` | Alice/Bob request presets, `Identity.Name` and literal `group` claims |
| `/orders` | Registered `Order` type; compare VIP, standard and missing entity |
| `/filters` | Matching/non-matching request presets against the same catalog |
| `/integrations` | Persistence, refresh/failure behavior, export and cloud migration |
| `/internal/features` | The actual NuGet-packaged management UI: edit, targeting, import/export, contexts, diagnostics |

### Targeting and entity mapping

The app uses the published `HttpContextTargetingContextAccessor`. It reads
`User.Identity.Name` and `group` claims from the current request. The workshop's
query presets simulate an **unauthenticated** principal and browser/proxy headers;
they store nothing on a singleton and never modify requests under the dashboard
mount. These are teaching inputs, not credentials or an authorization system.

- `?preset=matching`: Alice, `role=admin`, `group=beta-testers`, US, English,
  Chrome on macOS, `ord-vip` with `Vip=true` and `Total=249`.
- `?preset=nonmatching`: Bob, `role=user`, no group, CA, French,
  Firefox on Windows, `ord-standard` with `Vip=false` and `Total=49`.
- `?order=standard` / `?order=vip` changes the entity independently of the persona.

`AddTogglyEntityContext<Order>` registers `Id` as the key and maps `Vip` / `Total`.
Evaluation passes the actual `Order` instance to `IsEnabledAsync`. An entity-targeted
feature without an entity is false. User/web and entity rule groups each have
Any/All semantics, and both groups must match when both are present.

The controller uses `IFeatureManager`, allowing comparison with and without an
entity for the same key. `IFeatureManagerSnapshot` caches a result by feature key
within one request, so use it when one answer per key is intended; do not use it
to compare multiple orders. The Toggly Razor helper uses entity-aware evaluation.

### Shared template adaptations

Names and presets follow [`FLAG_TEMPLATE.md`](../docs/FLAG_TEMPLATE.md). This app
needs **no SaaS app setup** and has one logical environment, `Production`.

- Embedded v1 supports Boolean flags, not variants, allocations, experiments or
  analytics. A Boolean branch is not experiment assignment.
- The .NET UAParser reports the matching preset's device family as **`Mac`**.
  The included rule uses `DeviceType:0 = Mac`, adapting the shared template's
  `Macintosh` to the actual published SDK value. Browser family remains `Chrome`
  and operating system uses `OperatingSystem:0 = Mac`.
- The country alias is `CountryFamily`, with `Country:0 = US` and `Percentage = 100`.
  Matching reads `CF-IPCountry`; no GeoIP service is called.
- The 50% percentage result is stable for the same feature/identity. Neither
  preset promises a particular result. It is not a new random choice each request.
- Always-on and the 2020–2099 schedule match both presets while that window is open.
  Restrictive targeting, claims, country, browser, language, device, OS and entity
  rules match Alice's preset and reject Bob's after import.
- There is no missing-app-key banner because no key exists in this mode. The
  visible uninitialized/unavailable storage banner is the relevant setup feedback.

## Persistence, configuration and security

`Program.cs` explicitly calls `EnsureCreatedAsync()` for the sample's **dedicated**
SQLite database before serving requests. It creates a missing database and its
schema, but never seeds or overwrites a catalog. A schema setup failure aborts
startup. Do not copy this setup into an arbitrary existing application database;
use the provider's catalog-only schema script or host migrations there.

The catalog name is explicitly fixed to `EmbeddedDashboardSample`. Keep a stable
name across hosts sharing storage. Save and restart with the same database path
to retain your flags. Back up with dashboard Export; import backups explicitly.
Do not delete the database as a routine startup or recovery step. If the database
file is lost, restore its backup before restarting: this sample's schema setup
would otherwise create an empty database.

A successful dashboard write publishes to this host immediately. The default
five-second polling interval lets other hosts observe changes. After schema setup
succeeds, an initial runtime catalog-read failure leaves flags false. Later refresh
failures retain the last valid snapshot and report stale/unavailable state; the
runtime does not reset a missing or invalid catalog. The dashboard Storage page
reports the active revision and last successful refresh.

[`.env.example`](.env.example) documents optional **process environment variables**;
ASP.NET Core does not load that file automatically. There are no browser-exposed
configuration variables or build-time app keys:

| Variable | Default / effect |
|---|---|
| `ASPNETCORE_URLS` | Use `--urls http://127.0.0.1:5080` in the quick start; controls listening address |
| `ConnectionStrings__TogglyCatalog` | `Data Source=toggly.sample.db;Pooling=False`; optional server-only SQLite override |

The package's default dashboard access is restricted to a **direct loopback peer**.
Forwarding headers reject that fallback. The demo persona cannot authorize the
dashboard. If deploying behind a proxy or for remote users, configure your real
host authentication and authorization middleware, then attach a policy:

```csharp
app.UseAuthentication();
app.UseAuthorization();
app.MapTogglyDashboard("/internal/features")
   .RequireAuthorization("FeatureAdmins");
```

Register `FeatureAdmins` and your actual authentication scheme in the host; this
snippet is the mapping change, not a complete login implementation. Keep host
Data Protection keys and persistent storage configured appropriately. Presentation
and feature gates do not replace permission checks. The sample's public workshop
pages and snapshot endpoint expose demonstration data and are not production APIs.

## Move to SaaS

The packaged `/internal/features/cloud` page explains migration without connecting
to a service. When you choose to migrate:

1. Export the local catalog and retain the backup for rollback.
2. Import it into one existing SaaS application/environment; review conflicts,
   application-wide metadata changes and any required approvals.
3. Verify the imported definitions have been published before switching evaluation.
4. Configure a backend SDK key and destination environment. Replace
   `AddTogglyDashboard()` with the normal `AddTogglyWeb()` registration.
5. Preserve the same targeting accessor, `Identity.Name` / `group` mapping, and
   `Order` entity registration. Remove `MapTogglyDashboard()`.

Never register cloud and embedded definition providers together. Local sample
checks prove local behavior; they do not prove a destination SaaS application's
permissions, approvals or publication state.

## Source reading map and dependencies

| File | Why it matters |
|---|---|
| `src/EmbeddedDashboardSample/Program.cs` | Public package registration, dedicated schema setup and loopback dashboard mapping |
| `Features/SamplePersonas.cs` | Request-local simulated inputs, excluded from dashboard requests |
| `Controllers/ShowcaseController.cs` | Boolean and entity evaluation, JSON snapshot and MVC gate |
| `Views/_ViewImports.cshtml` | Registers the Toggly tag helper without duplicate Microsoft helper evaluation |
| `Views/Showcase/Gates.cshtml` | Declarative, negated, multi-key and entity callsites |
| `example-catalog.json` | Portable, editable rules for the whole workshop |
| `tests/EmbeddedDashboardSample.Tests/WorkshopTests.cs` | Real SQLite, request separation, dashboard forms and restart tests |

All Toggly dependencies resolve to **3.7.0** from **nuget.org**. Direct references:

| Package | Version |
|---|---|
| `Toggly.FeatureManagement.Dashboard` | 3.7.0 |
| `Toggly.FeatureManagement.Storage.EntityFramework` | 3.7.0 |
| `Microsoft.EntityFrameworkCore.Sqlite` | 8.0.31 (`net8.0`), 10.0.12 (`net10.0`) |
| `Microsoft.FeatureManagement.AspNetCore` | 4.7.0, for the MVC feature-gate attribute |
| `SQLitePCLRaw.bundle_e_sqlite3` | 3.0.5, pins a patched native engine instead of EF 8's older transitive baseline |

Catalog, Embedded, Web and the core evaluator are transitive published dependencies.
`NuGet.Config` clears inherited feeds and uses only nuget.org. Committed lockfiles
contain real registry hashes. The application has no SDK source project references,
local package drops or vendored NuGet packages. The test project references only
this sample application.

## Checks and manual checklist

```bash
dotnet restore --locked-mode
dotnet build -c Release --no-restore
dotnet test -c Release --no-build --no-restore
dotnet publish src/EmbeddedDashboardSample -c Release -f net10.0 --no-restore -o artifacts/publish
```

Install both .NET 8 and .NET 10 runtimes to run both test targets. Tests use isolated
temporary SQLite databases and real published packages; no app keys or cloud mocks
are needed. CI runs each target, locked restore, tests, publish and HTTP smoke.

- [ ] Fresh database shows uninitialized storage and all flags OFF.
- [ ] First-toggle steps change actual Razor markup after browser refresh.
- [ ] Import preview changes nothing until Apply; export downloads the stored catalog.
- [ ] Matching/non-matching presets differ for restrictive rules; entities remain request-local.
- [ ] `/api/beta` returns 404 while disabled and 200 while enabled.
- [ ] Disable a targeted flag, restart, export and re-enable: its targeting rules remain.
- [ ] Desktop and narrow layouts are readable; keyboard focus and labels are usable.
- [ ] Remote dashboard requests and missing-antiforgery POSTs are rejected.
