# Blazor SDK workshop

An actual .NET 8 Blazor Web App with separately compiled WebAssembly client code.
Explore static SSR, Interactive Server, WebAssembly and Interactive Auto using
`Toggly.FeatureManagement.Blazor` **3.8.0**, `.Blazor.Server` **3.8.0**, portable
Client **3.8.0** and trusted `.NET` **3.8.0**. Live mode reports definition cache
hits on the usage pipeline; offline and `ci-placeholder` runs do not upload usage.
`python scripts/soak.py` waits for refresh + flush when a real `TOGGLY_APP_KEY` is set.
Presentation gates are not backend
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
a service. SDK HTTP traffic in the blank-key demonstration is intercepted locally,
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

## Persist trusted Server definitions across restarts

Set `TOGGLY_SNAPSHOT_DIRECTORY` to an absolute, private directory **outside the
application content root and source checkout**. Supply the Backend App Key and
case-sensitive environment through the server process environment as above.
Persistence is opt-in; leaving the directory unset keeps the existing behavior.
Do not put this directory in `wwwroot`, a browser profile, or version control.

The Sample-owned `FileFeatureSnapshotProvider` implements the trusted .NET SDK's
`IFeatureSnapshotProvider`; it is not the portable Client's `FileSnapshotStore`.
No additional package or database is needed. A hash of the app-key/environment
pair namespaces records without storing the key. Each definitions or public JWKS
record is limited to 4 MiB and replaced atomically using a temporary file in the
same directory. Unix directories/files are owner-only (0700/0600). On Windows,
place the directory under a service-account-only ACL before starting the host.
Symbolic links, empty entries (including stable Unix FIFOs), malformed/oversize
records and mismatched namespaces are rejected. Entry checks assume a stable,
trusted directory; they do not defend against a hostile service-account process
racing to replace paths.
Use one application host/service account per directory; this is not a distributed
cache or a multi-writer deployment design.

The directory remains **trusted local application state**, including the public
JWKS. SDK 3.8.0 re-verifies the exact saved signed definitions and rejects a typed
copy that differs from those bytes. This does not authenticate simultaneous
replacement of both definitions and their saved public signing keys by an attacker
who controls the directory. The adapter preserves the SDK's timestamp fields;
SDK 3.8.0 does not enforce the persisted JWKS expiry timestamp or a maximum offline
definitions age. Offline operation cannot learn about a revoked signing key or
new flag value. Protect the service account and storage, and reconnect to obtain
current definitions. Do not treat this cache as a new independent trust anchor.

To exercise a real restart after configuring the flags, first publish the host
and start it online with the same environment-provided credentials you normally
use. For example, choose `/private/var/lib/blazor-toggly` on a Unix host where your
service account owns that directory (use your own absolute private path):

```sh
# Run from the published directory; credentials are already in this process environment.
TOGGLY_SNAPSHOT_DIRECTORY=/private/var/lib/blazor-toggly \
  dotnet BlazorSample.dll --urls http://localhost:5280
```

Visit `/server/home` and turn `new-dashboard` ON. Wait for **New dashboard enabled**
and for `definitions.json` and `jwks.json` to exist beneath the snapshot directory.
Stop that host completely. Start a **new process**, retaining the same Backend
App Key, environment and snapshot directory, with explicit offline mode:

```sh
TOGGLY_SNAPSHOT_DIRECTORY=/private/var/lib/blazor-toggly \
TOGGLY_NETWORK_MODE=offline \
  dotnet BlazorSample.dll --urls http://localhost:5280
```

Offline mode requires both the backend key and snapshot directory. It supplies
no fixture definitions. SDK HTTP/gRPC calls are denied before transport and
retries are removed; the SDK's separate direct WebSocket is confined to the
unused loopback port `127.0.0.1:1`. That connection may be attempted but cannot
reach the definitions service. Local Blazor SignalR remains available. Ensure
nothing listens on that port. Use an OS egress policy as well when your deployment
requires prohibition of every external socket independently of application settings.

Open a fresh `/server/home` circuit: ON must survive the restart. With missing,
corrupt, or wrong-app/environment storage, an unknown `new-dashboard` instead
resolves OFF (**Classic dashboard**); the trusted SDK's missing-definition startup
waits still apply. Check `/server/identity` and `/server/entity` against your saved
rules too. Server **Refresh** re-evaluates cached definitions in this mode; it
cannot fetch a newer flag value. Return `TOGGLY_NETWORK_MODE` to `online` and
restart to resume service updates. This setting applies to the trusted server;
WASM and Auto browser execution retain their own network/cache configuration.

`TOGGLY_DEFINITIONS_URL` is a server-only override of the SDK's trusted definitions
origin, chiefly useful for the local signed integration test. It accepts absolute
HTTPS or loopback HTTP without credentials, query or fragment. Leave it unset for
Toggly SaaS; an arbitrary untrusted origin would also supply signing keys. Explicit
offline mode takes precedence. It is never included in public browser settings.

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

| Path after render mode | Requirement and teaching surface                                     | Source                                           |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| `home`                 | Map, flag checklist, live snapshot, first toggle                     | `BlazorSample.Client/Workshop.razor` home branch |
| `gates`                | Paired child/negated content, loading, all/any; variants distinction | Same file, gates branch                          |
| `api`                  | Programmatic evaluate/refresh                                        | Same file, API branch and `Evaluate`             |
| `identity`             | Matching alice/vip/admin and non-matching bob/standard/user          | Same file, `SetPreset`                           |
| `entity`               | `ord-vip` vs `ord-standard`, Order.Vip                               | Same file, entity branch                         |
| `filters`              | Full shared filter matrix, explicit unsupported rows                 | Same file, filters branch                        |
| `framework`            | Runtime lifecycle, refresh, failures, subscription cleanup           | Same file, framework branch and `Dispose`        |
| Every page             | Missing-key banner without crashing                                  | Same file, header                                |

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

### Public NuGet 3.10.0 WebAssembly telemetry acceptance

`tests/PublicTelemetryHost` is a separate, credential-free browser fixture for
`Toggly.FeatureManagement.Blazor` and its portable Client dependency at **3.10.0**.
It restores from NuGet, not from the SDK repository, a local nupkg, or a project
reference. The teaching workshop above retains its own 3.8.0 contract and render
matrix; this fixture adds a focused real-browser transport gate. Its key,
environment, and metrics URL are synthetic, chosen from the page query string.
Only the test's loopback collector receives POSTs. Definitions use an offline
handler, so fallback values and local prerequisites can be checked without a
live signed-definition service. The entity call covers the per-read API shape;
it does not prove a deployed Order rule or named variant allocation.

With .NET SDK 10.0.400 and Node 24, from `blazor-sdk/` (the subdirectory
`global.json` files select SDK 10 while the workshop root selects SDK 8):

```sh
(cd tests/PublicTelemetryHost && dotnet restore --locked-mode --source https://api.nuget.org/v3/index.json && dotnet publish --no-restore -c Release -p:WasmBuildNative=false)
(cd tests/ServerTelemetrySilence && dotnet restore --locked-mode --source https://api.nuget.org/v3/index.json && dotnet run --no-restore -c Release)
npm ci
npx playwright install chromium
npm run test:public-telemetry
```

The Chromium test serves only the published WASM files and two ephemeral
loopback origins. It checks the real component and session evaluation path,
explicit usage/view/counter/gauge/flush, separate browser owners, opt-out and
keyless silence, real navigation, and browser hide/pagehide/disposal. The collector verifies
OPTIONS and `202` POST, exact compact keys, gzip ordinary delivery, plain
keepalive delivery, no Authorization or Cookie header, and no groups, claims,
or entity attributes in the packet. `i` and `u` are recorded as actual public
3.10.0 behavior; this local run does not decide their open ingestion policy.
The companion public-package check verifies non-browser/prerender registration
evaluates a default with zero JS transport calls, and that the published Blazor
Server session does not implement the frontend reporter. The existing render
matrix continues to show SSR and Server UI paths. No production key,
production telemetry POST, Redis, or Victoria Metrics claim is made here.

```sh
dotnet restore BlazorSample.sln --locked-mode
dotnet build BlazorSample.sln --no-restore -c Release
npm ci
npx playwright install --with-deps chromium
# With the host listening at http://127.0.0.1:5280:
npm test
```

The persistence checks use the same public package locks. After publishing the
host to `published`, run:

```sh
dotnet restore tests/SnapshotChecks/SnapshotChecks.csproj --locked-mode
dotnet run --project tests/SnapshotChecks/SnapshotChecks.csproj --no-restore -c Release -- /absolute/private/test-directory
node --test tests/persistence.test.mjs
```

Use the same `SampleFramework`/`AspNetCoreVersion` properties for .NET 10 as above.
The C# checks exercise atomic replacement, file permissions, cancellation, bounds,
namespace isolation and symlink rejection. The browser test owns local signed
HTTP fixtures and fresh host processes; it verifies actual Server circuit recovery
and invalid-storage OFF decisions. These are credential-free fixture checks,
not a claim of live-service persistence acceptance. The existing CI runs both native
toolchains. `PUBLISHED_DIRECTORY` and `DOTNET_HOST_PATH` can select an alternate
published output and its matching host executable.

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
