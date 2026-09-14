# Blazor SDK workshop

An actual .NET 8 Blazor Web App with separately compiled WebAssembly client code.
Explore static SSR, Interactive Server, WebAssembly and Interactive Auto using
`Toggly.FeatureManagement.Blazor` **3.7.0**, `.Blazor.Server` **3.7.0**, portable
Client **3.7.0** and trusted `.NET` **3.7.0**. Presentation gates are not backend
authorization; demo personas do not authenticate a user.

## Quick start

Install .NET SDK **8.0.425** and run from this directory. `global.json` selects
that exact SDK; a missing version fails instead of silently selecting a newer SDK:

```sh
dotnet restore BlazorSample.sln --locked-mode
ASPNETCORE_ENVIRONMENT=Development dotnet run --project BlazorSample --no-restore --no-launch-profile --urls http://localhost:5280
```

To build a native .NET 10 host/client, install SDK **10.0.400**, change
`sdk.version` in this directory's `global.json` to `10.0.400`, and use
`dotnet restore BlazorSample.sln --locked-mode -p:SampleFramework=net10.0 -p:AspNetCoreVersion=10.0.11`,
then `dotnet publish BlazorSample --no-restore -c Release -p:SampleFramework=net10.0 -p:AspNetCoreVersion=10.0.11 -o published`
then `cd published` and run `dotnet BlazorSample.dll --urls http://localhost:5280`.
Set `sdk.version` back to `8.0.425` for the .NET 8 commands. Keep `rollForward`
set to `disable`. SDK patch releases can change implicit build-tool packages, so
selecting the matching SDK is required as well as selecting the target framework.
Rebuild with the matching framework; do not merely roll an already published
.NET 8 application's runtime forward because framework static-asset routing changes.

Each project retains separate `packages.net8.0.lock.json` and
`packages.net10.0.lock.json` files generated from public NuGet packages. Restore
with the same framework and ASP.NET Core version used for the build; locked mode
rejects a dependency mismatch instead of silently changing the selected versions.
The projects disable implicit SDK package caches so the locks use the public
NuGet package contents consistently across development machines and CI.

Open [localhost:5280](http://localhost:5280). The four host routes are `/ssr/home`,
`/server/home`, `/wasm/home`, and `/auto/home`. Auto may start on the server and
choose WebAssembly on a later visit after downloading the client. Inspect the
runtime badge rather than assuming which runtime it selected. Static SSR renders
once per request, so its buttons are disabled; Matching/Non-matching links make
fresh requests with distinct scoped contexts.

Blank keys work intentionally: the missing-key banner stays visible. The server
feeds offline definition fixtures through the actual trusted SDK parser/filters;
browser defaults turn the baseline flags ON and restrictive/entity flags OFF.
Browser defaults do not simulate a signed Order rule. No fake app key is sent to
a service. SDK HTTP traffic in server offline mode is intercepted locally,
including telemetry; its independent WebSocket is limited to unused loopback.

## Configure Toggly

Follow [APP_SETUP](../docs/APP_SETUP.md) and [FLAG_TEMPLATE](../docs/FLAG_TEMPLATE.md).
Create **Blazor SDK Sample**, environment **Production**, and all shared flags.
Use an existing supported application technology; App Settings can generate an
additional **Front-end App Key** without a Blazor picker entry. Keep the backend
key on the server. Set all browser flags **Available to Client SDK**, and allow
exact origins `http://localhost:5280` (plus `http://127.0.0.1:5280` when used).

Create **Order**, key property **Id**, boolean **Vip**, optional numeric **Total**.
Bind `ExpressCheckout` and `filter-context-property` to Order; use ContextProperty
`Vip`, operator `eq`, value `true`, value type `boolean`. Remove extra AlwaysOn
conditions from restrictive flags.

Pass the variables documented in [.env.example](.env.example) through your normal
server process environment or development configuration. This sample does **not**
automatically load `.env`. There is no browser build-time substitution or public
prefix magic: `/public-toggly.json` explicitly returns only the Front-end App Key,
environment and a backend-configured boolean. Backend and management credentials
never belong in `BlazorSample.Client`, that response, or persistent component state.
The environment is case-sensitive; the fallback is Production.

## First-toggle exercise

1. Open `/server/home` or `/wasm/home` with the appropriate real key configured.
2. Switch `new-dashboard` ON in Toggly: expect **New dashboard enabled** after the
   provider receives updated definitions.
3. Switch it OFF: expect **Classic dashboard**. Browser Refresh fetches definitions;
   server Refresh re-evaluates its current cache while the trusted provider owns
   network polling/push.
4. Open `/gates` for negate and all/any branches, and `/api` for imperative results.

Complementary UI uses two `Feature` components with identical inputs. The ON
block uses ordinary child content, the OFF block sets `Negate="true"`, and only
one block owns `Loading` while evaluation is pending.

A key identifies a feature. Definitions belong to an app/environment; evaluation
combines them with context. Initialization gets definitions, defaults cover missing
configuration/startup, and refresh/cache policy controls later changes. Signed
browser failures keep verified last-known values or defaults and report an error.
The trusted server SDK retains its own signed-definition/cache and usage policy.

## Section map

| Path after render mode | Requirement and teaching surface | Source |
| --- | --- | --- |
| `home` | Map, flag checklist, live snapshot, first toggle | `BlazorSample.Client/Workshop.razor` home branch |
| `gates` | Paired child/negated content, loading, all/any; variants distinction | Same file, gates branch |
| `api` | Programmatic evaluate/refresh | Same file, API branch and `Evaluate` |
| `identity` | Matching alice/vip/admin and non-matching bob/standard/user | Same file, `SetPreset` |
| `entity` | `ord-vip` vs `ord-standard`, Order.Vip | Same file, entity branch |
| `filters` | Full shared filter matrix, explicit unsupported rows | Same file, filters branch |
| `framework` | Runtime lifecycle, refresh, failures, subscription cleanup | Same file, framework branch and `Dispose` |
| Every page | Missing-key banner without crashing | Same file, header |

## Source-reading map

- `BlazorSample/Program.cs`: trusted key boundary, real .NET SDK registration,
  scoped Blazor server integration, explicit public settings response.
- `BlazorSample.Client/Program.cs`: browser registration and deliberate defaults;
  the browser-safe SDK owns lazy WebCrypto/localStorage and portable refresh.
- `BlazorSample.Client/Pages/*Page.razor`: actual render modes, FeatureProvider and
  public boolean hydration allowlist. The server project references the client;
  the client never references the server SDK.
- `BlazorSample.Client/Workshop.razor`: paired child/negated gates, per-evaluation Order mapping,
  programmatic checks and renderer-dispatched change/error subscriptions.
- `BlazorSample/Features/OfflineTransport.cs`: offline data in the published server
  schema, not a replacement evaluation engine. Fixtures include baseline flags,
  Percentage 50, Targeting alice, TimeWindow 2020–2099 and Order.Vip rules.

## Filter limits and contexts

Matching is alice, vip group and `role=admin`; non-matching is bob, standard group
and `role=user`. The server fixture expects Targeting ON/OFF respectively and
VIP ON/standard OFF. Percentage is sticky, so it has no prescribed matching result.
TimeWindow stays ON while inside its UTC interval; AlwaysOn remains ON.

The circuit adapter's built-ins cover core .NET filters: AlwaysOn, Percentage,
Targeting, TimeWindow, ContextProperty. It deliberately does not reuse stale
HttpContext for claims/country/UA/language/device/OS filters. Those rows require
explicit custom scoped filters on the server. Browser endpoint evaluation supports
user/HTTP filters, but changing this demo persona does not spoof browser headers.
Country/language/UA reflect the real browser/network; there is no HTTP-header
preset override in this browser API. Unsupported rows are labeled in the table.

In a production authenticated app, FeatureProvider maps AuthenticationStateProvider
and tracks sign-in/logout changes. A circuit/request owns its context, evaluations
snapshot it before awaits, and other circuits are independent. Browser claims are
untrusted targeting hints. The adapter only selects boolean branches; it does not
assign named variants or record a new experiment API.

## Manual checklist

- Visit all seven sections in every render mode; no missing-key crash.
- Run the first toggle with real keys and check both visible branches.
- Use two separate browser contexts: alice in one, bob in the other. Targeting
  changes must not cross circuits. Reconnect a Server circuit and recheck.
- Compare `ord-vip` and `ord-standard`; browser defaults deny both until live entity
  definitions exist. Never mark offline defaults as proof of live provisioning.
- On `/framework`, Refresh re-evaluates and increments observed updates. With a
  configured live browser key, go Offline in DevTools and Refresh: observe Error
  while the verified cache/default result remains. The localStorage snapshot
  persists the signed envelope and previously accepted public signing keys as local
  application state. A fresh browser runtime restores and reverifies it against
  its context, age and current configured key restrictions without contacting the
  definitions service. Keys stored beside the signed envelope are not an
  independent trust anchor; use AllowedKeyIds or authoritative TrustedJwks to pin
  keys. WebAssembly assets need separate offline delivery; server circuits require
  the server. Bad signatures never replace accepted definitions.
- Inspect the browser bundle/public settings/prerender payload: only allowlisted
  public boolean hydration is transferred; no backend/management key or claims.
- Sign out with your host's real AuthenticationStateProvider and verify gates change.

## Automated checks

```sh
dotnet restore BlazorSample.sln --locked-mode
dotnet build BlazorSample.sln --no-restore -c Release
npm ci
npx playwright install --with-deps chromium
# With the host listening at http://127.0.0.1:5280:
npm test
```

The browser suite exercises real SSR/Server/WASM/Auto hosts, isolated contexts,
entity behavior, signed client HTTP fixtures, live invalidation, corrupt-signature
and network failure. Its fixture routes intercept all definition HTTP/WebSockets;
test configuration never contacts a live service. This is local consumer evidence,
not proof that the dashboard app or keys have been provisioned.

## Live signed-service acceptance

`tests/live.browser.mjs` exercises the actual WASM Sample against the live
service. Configure the host and runner with the same environment-provided
`TOGGLY_FRONTEND_APP_KEY` and exact `TOGGLY_ENVIRONMENT`. Use an isolated Sample
application, allow the exact localhost origin, set `new-dashboard` initially
**disabled**, and configure `filter-targeting` for Alice/vip but not Bob/standard.
Start the source-tree host in Development mode using the quick start above,
or run a published host as the existing CI workflow does. The runner verifies public settings
match its environment without printing keys.

```sh
npm ci
npx playwright install chromium
TOGGLY_LIVE_ACCEPTANCE=1 SAMPLE_URL=http://localhost:5280 node tests/live.browser.mjs
```

When prompted, an operator turns `new-dashboard` **on**, then **off**, within
two 45-second windows. The runner stays on the mounted WASM page and requires
actual WebSocket invalidations followed by changed signed HTTP responses,
matching durable snapshots and complementary dashboard rendering. Its complete
three-minute budget is shorter than the SDK's five-minute polling interval.
It never invokes Refresh or fulfills a synthetic network response.

The runner closes Chromium and launches a new process using the same temporary
profile. All external HTTP and WebSocket traffic is denied; localhost assets
and public settings remain reachable. Alice's verified disabled dashboard must
survive restart, and Alice/Bob targeting must remain isolated. Browser storage
is checked against the hash of the actual live response. Temporary browser
storage is removed afterward; remote flags are never changed by the runner.
If a run fails between prompts, restore the original disabled flag manually.

This proves cold **SDK** recovery during a definitions-service outage. It does
not claim a completely offline application shell, persistent Blazor Server
snapshots, production signing-key rotation, or Auto-mode browser execution.
The separate fixture suite remains available through `npm test`.

Credential-free harness regression checks:

```sh
node --test tests/live-policy.test.mjs
node tests/live.browser.mjs # exits 2 with configuration-required without opt-in
```
