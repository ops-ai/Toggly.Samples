# Blazor SDK workshop

An actual .NET 8 Blazor Web App with separately compiled WebAssembly client code.
Explore static SSR, Interactive Server, WebAssembly and Interactive Auto using
`Toggly.FeatureManagement.Blazor` **0.1.0**, `.Blazor.Server` **0.1.0**, portable
Client **0.1.0** and trusted `.NET` **3.6.6**. Presentation gates are not backend
authorization; demo personas do not authenticate a user.

## Quick start

Install the .NET 8 SDK and run:

```sh
dotnet restore BlazorSample.sln
dotnet run --project BlazorSample --no-launch-profile --urls http://localhost:5280
```

To build a native .NET 10 host/client with .NET 10 installed, use
`dotnet publish BlazorSample -c Release -p:SampleFramework=net10.0 -p:AspNetCoreVersion=10.0.11 -o published`
then `cd published` and run `dotnet BlazorSample.dll --urls http://localhost:5280`.
Rebuild with the matching framework; do not merely roll an already published
.NET 8 application's runtime forward because framework static-asset routing changes.

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

A key identifies a feature. Definitions belong to an app/environment; evaluation
combines them with context. Initialization gets definitions, defaults cover missing
configuration/startup, and refresh/cache policy controls later changes. Signed
browser failures keep verified last-known values or defaults and report an error.
The trusted server SDK retains its own signed-definition/cache and usage policy.

## Section map

| Path after render mode | Requirement and teaching surface | Source |
| --- | --- | --- |
| `home` | Map, flag checklist, live snapshot, first toggle | `BlazorSample.Client/Workshop.razor` home branch |
| `gates` | Enabled/disabled/loading, negate, all/any; variants distinction | Same file, gates branch |
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
- `BlazorSample.Client/Workshop.razor`: actual gates, per-evaluation Order mapping,
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
  while the verified cache/default result remains. A fresh browser runtime restores a valid localStorage snapshot and its previously accepted public keys without contacting the definitions service;
  the sample does not persist or implicitly trust signing keys. With keys available,
  the signed localStorage snapshot is reverified against its context, age and configured key restrictions. Local cached key material is application state, not an independent trust anchor; use AllowedKeyIds or authoritative TrustedJwks to pin keys. WebAssembly assets need separate offline delivery; server circuits require the server. Bad signatures never replace accepted definitions.
- Inspect the browser bundle/public settings/prerender payload: only allowlisted
  public boolean hydration is transferred; no backend/management key or claims.
- Sign out with your host's real AuthenticationStateProvider and verify gates change.

## Automated checks

```sh
dotnet build BlazorSample.sln -c Release
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
