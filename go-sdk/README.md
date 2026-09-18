# Go SDK workshop

A runnable `net/http` and `html/template` application for learning feature flags with the published Toggly Go SDK. Start with one flag, then explore request identity, business entities, filter rules, native gates, and variants.

## Quick start

Requires **Go 1.27.1** (the module's `go` directive lets a compatible Go installation download that toolchain normally).

```bash
cd go-sdk
go mod download
# An explicit offline mode: no Toggly account or app key needed.
TOGGLY_OFFLINE=true go run ./cmd/showcase
```

Open [http://localhost:8080](http://localhost:8080). Offline practice starts a loopback definitions service with an ephemeral signing key; the actual published SDK downloads, verifies, and evaluates its fixture definitions. The banner labels every page as offline. This is a learning fixture, not proof that a dashboard application has been provisioned.

To use your own app:

```bash
cp .env.example .env.local
# Edit TOGGLY_APP_KEY locally; keep TOGGLY_OFFLINE=false.
# The application reads process environment, not dotenv files automatically.
set -a
. ./.env.local
set +a
go run ./cmd/showcase
```

Without a key and without offline mode, the server still runs and shows **Missing app key** on every page. No client is created and no network request is made. Tables report unavailable, presentation uses its OFF branch, and protected endpoints return 404. Never commit `.env.local` or real keys.

## Your first feature flag

A feature flag is a named decision that separates shipping code from enabling a feature. The code asks whether `new-dashboard` is on; the SDK evaluates the rules you configured.

1. Open **Gates** with offline practice running. The native template shows the new dashboard.
2. Press **Turn dashboard OFF**. This changes only the local fixture. Wait for the next refresh (every 30 seconds), then reload.
3. The classic dashboard and negated branch appear. Any remains on because `api-v2` is on; All becomes off. Turn the dashboard on to restore it.
4. With a real app, flip `new-dashboard` in Toggly instead. The same application code responds after its next refresh.

A flag is not authentication or permission to access sensitive data. Keep your application's authorization checks in place.

## Create your Toggly application

Dashboard provisioning is a manual setup step. Use the
[shared application setup guide](../docs/APP_SETUP.md) for picker names,
context registration, and the single-feature management API fallback when a
filter is missing from the catalog. You do not need a workspace named Toggly
Samples.

1. Open [app.toggly.io](https://app.toggly.io). Use a workspace you can manage
   (the one created at signup is enough) and create **Go SDK Sample**. The shared
   picker table has no dedicated Go row; choose the **Go** technology option if
   it is present, otherwise the closest server/SDK label your workspace offers,
   and keep this application dedicated to the sample.
2. Use the **Production** environment. Local URL:
   **http://localhost:8080**. This sample evaluates on the server only, so the
   current UI typically has no **Allowed Web Origins** control. Do not switch
   technology just to reveal CORS settings. If you later add browser SDK calls,
   add `http://localhost:8080` and `http://127.0.0.1:8080` as origins.
3. Create context kind **Order**: `Id` is a string and its key; `Vip` is boolean; `Total` is an optional number. The sample registers a local mapper once, and disables automatic remote schema registration so startup does not change your dashboard.
4. Create these exact flags:

| Key | Configuration |
| --- | --- |
| `new-dashboard` | Enabled baseline; switch on/off for feature and negate demos |
| `api-v2` | Enabled baseline for Any/All examples |
| `enhanced-submit` | Enabled baseline for the gated POST action |
| `ExpressCheckout` | ContextProperty on **Order**, property `Vip`, equals `true`, boolean |
| `beta-access` | Enabled baseline for the native HTTP gate |

5. Create a **Filters** category and the following eleven flags. Use a 100% segment percentage where the filter asks for one; a missing/zero segment percentage evaluates false in this SDK.

| Flag | Rule |
| --- | --- |
| `filter-always-on` | AlwaysOn |
| `filter-percentage` | Percentage 50%, sticky by identity |
| `filter-targeting` | Targeting: users include `alice` |
| `filter-user-claims` | UserClaims: `role` equals `admin`, percentage 100 |
| `filter-time-window` | TimeWindow: 2020-01-01 through 2099-12-31 |
| `filter-country` | Country `US`, percentage 100 |
| `filter-browser-family` | BrowserFamily `Chrome`, percentage 100 |
| `filter-browser-language` | BrowserLanguage includes `en`, percentage 100 |
| `filter-device-type` | DeviceType `Macintosh`, percentage 100 |
| `filter-os` | OperatingSystem `Mac`, percentage 100 |
| `filter-context-property` | ContextProperty on **Order**, `Vip` equals `true`, boolean |

6. For the variant section, configure `new-dashboard` variants named **compact** and **control**, with JSON configuration `{"layout":"compact"}` and `{"layout":"control"}`. Assign alice to compact and bob to control using your variant targeting rules. The UI displays whatever the server actually assigns; it does not manufacture a missing variant. The baseline boolean flag and variant assignment are separate concepts, and the published package has no API that returns both as one snapshot.
7. Put this app's key only in `.env.local`, start the app, and walk the checklist below. `TOGGLY_APP_KEY` is read by Go on the server; no browser-build prefix is needed.

The canonical [shared flag recipe](../docs/FLAG_TEMPLATE.md) applies unchanged. Matching uses alice/admin/US, `en-US,en;q=0.9`, VIP `ord-vip`, and:

```text
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

Non-matching uses bob/user/CA, `fr-FR,fr;q=0.9`, non-VIP `ord-standard`, and:

```text
Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0
```

The shared demo group is `sample-users`. Header fields are deliberately synthetic preset values, including the country corresponding to `cf-ipcountry`; your real integration should populate them from trusted request/proxy metadata.

## Sections

| Path | Learn and observe |
| --- | --- |
| `/` | First-flag exercise, section map, flag checklist, current request snapshot, missing-key banner |
| `/gates` | Native `feature`, `featureAny`, `featureAll`, Go `not`, independently labeled assignment and enabled reads |
| `/programmatic` | `IsEnabled`, `EvaluateGate` Any/All and per-flag negate; gated POST action |
| `/identity` | Initial identity/groups/claims/request context and `MiddlewareWith` handoff |
| `/orders` | Two actual Order evaluations in one request; VIP versus standard |
| `/filters` | All eleven filters, Matching/Non-matching presets, documented device parser gap |
| `/integrations` | `MiddlewareWith`, FeatureGate, signatures, background refresh, cancellation and shutdown |
| `/api/snapshot` | Current evaluation JSON, with no app key or raw network errors |
| `/beta` | Native `beta-access` HTTP gate: 200 when on, 404 when off/missing |
| `POST /submit` | Native `enhanced-submit` gate; demonstrative accepted response, no saved data |

## Read the source in this order

1. [`cmd/showcase/main.go`](cmd/showcase/main.go): environment configuration, HTTP server timeouts, graceful shutdown and client ownership.
2. [`internal/workshop/context.go`](internal/workshop/context.go): schema registration, a fresh context for each request, bounded persona cookie and entity mapping.
3. [`internal/workshop/app.go`](internal/workshop/app.go): shared definitions client, fixed-identity variant clients, native middleware, gates and per-call evaluation. Comments explain why context is explicit.
4. [`templates/page.html`](internal/workshop/templates/page.html): native helpers receive page data implementing `TogglyContext()`. Normal Go template conditionals supply negation. Assignment and enabled are labeled as independent reads; compact/control layout follows the assignment name only.
5. [`internal/fixture/server.go`](internal/fixture/server.go): explicitly offline definitions only. You do not need this service in a real integration.
6. [`internal/workshop/app_test.go`](internal/workshop/app_test.go): real published clients tested through HTTP, templates, concurrency, signature failures and lifecycle.

## Why context is supplied before evaluation

The normal client loads full definitions once and refreshes them in the background. Each `IsEnabled(r.Context(), key, evalCtx)` call evaluates locally using identity, groups, claims, request fields, and Order together. Switching from alice to bob requires no new definitions fetch.

Published `togglyhttp.MiddlewareWith` stores context on the request (`GetContext`
plus header enrichment for missing UA / language / country). `Client.IsEnabled`
merges that ambient context with per-call fields; non-empty per-call values win.
Handlers still retrieve the stored context with `togglyctx.From` and pass it
explicitly. Template data implements `TogglyContext()`. The sample never mutates
a shared client identity from request handling. The persona selector is sample
code, not a native authentication API.

Variants use a different server-evaluated endpoint. This sample has exactly two
extra clients, initialized with `VariantIdentity`, `VariantGroups`, and
`VariantClaims` for alice/admin and bob/user. v0.8.1 copies those values into
the first `evaluated-variants-signed` query. They cannot leak assignments by
changing shared identity. They live until shutdown, so there is no per-request
client creation or unbounded identity cache. In a real server, design a bounded
per-identity lifetime if you need arbitrary identities. Do not call
`SetVariantIdentity` on a client shared by concurrent HTTP requests.

## Behavior and SDK boundaries

- **Loading and refresh:** `NewClient` returns before the first response. Unknown/unloaded flags are false. The page displays the last successful refresh timestamp, and snapshots reevaluate on every request. No browser auto-refresh or public manual SDK Refresh method is assumed. An error retains last accepted definitions; the SDK's historical error timestamp remains visible even after a later success. Variant clients have their own refresh status.
- **Variant assignment vs enabled (split reads):** Published `toggly-go` v0.8.1 has no atomic variant+enabled API. `VariantResult` is only `{Name, ConfigurationValue}`. The server envelope also carries an `enabled` field, but `GetVariant` does not expose it. `GetVariant` and `IsEnabled` each take their own provider snapshot, so a background refresh can land between the two calls and pair a stale assignment with a newer enabled state. This sample renders assignment and enabled independently; compact/control layout follows the assignment name only and is not gated on the separate enabled read.
- **Filter expectations:** Matching turns on targeting, claims, country, browser, language, OS, and VIP context. Non-matching turns those off. AlwaysOn and TimeWindow stay on in both presets; 50% rollout results are stable for an identity, not prescribed as on/off by the preset.
- **DeviceType parser gap:** the published Go parser reports `Other` for the exact Macintosh desktop user agent, so `filter-device-type` remains off even under Matching. The sample does not rename the shared Macintosh rule to make it pass.
- **Entity kind limitation:** the published ContextProperty evaluator checks entity attributes but does not enforce `ContextKind` against `Entity.Kind`. The sample always maps the correct Order type and demonstrates absent entity as false. A kind name is not an access-control boundary.
- **Negate:** native `EvaluateGate(..., negate=true)` negates each flag before Any/All combination. Template `not (feature ...)` negates a single result.
- **Signed definitions:** all clients set `UseSignedDefinitions: true`; the local fixture supplies real ES256 signatures and protocol key IDs. Main definitions reject invalid signatures. The published variant path verifies when both signature and key ID exist, but accepts an envelope omitting those fields. Do not treat that option as strict enforcement for that path. The tests characterize missing-signature acceptance separately from tampered-signature rejection. Do not use variant assignments as authorization.
- **Cancellation:** the HTTP boundary stops already-canceled requests, and programmatic checks pass `r.Context()`. Native local evaluation does not itself check cancellation. Native template helpers internally use `context.Background()` and suppress evaluation errors. Their output is presentation; protected actions use a server gate.
- **Lifecycle:** HTTP shutdown precedes closing each client. The app wraps Close in `sync.Once` because native Close is not idempotent. Refresh requests already in progress are bounded by the configured three-second HTTP timeout.
- **Other surfaces:** `session.NewMemoryStore()` is a native optional session store. Stable-identity Percentage is already deterministic. The package also provides `SnapshotProvider`, `RegisterFilter`, `RecordUsage` and `MetricsClient`. `RecordUsage` is exercised after the gated sample action but sending is disabled; enabling usage/metrics starts external gRPC clients, which this sample intentionally leaves unconfigured. No Redis, MongoDB, live telemetry or persisted definitions are required.

## Package versions and verification

Verified at refresh time on 2026-09-17 against the Go module proxy and
`go.dev/dl`. Published `toggly-go` v0.8.1 requires Go 1.25 or later and
compiles with current `golang.org/x/crypto` and `golang.org/x/net`. This
sample keeps the Go 1.27.1 toolchain.

| Dependency | Version |
| --- | --- |
| Go stable toolchain | 1.27.1 |
| `github.com/ops-ai/Toggly.FeatureManagement/toggly-go` | v0.8.1 |
| Host framework | Go standard library `net/http` + `html/template` |

`go.mod` and `go.sum` resolve the published module normally; there is no local SDK replacement. Subpackages `toggly`, `togglyctx`, `togglyhttp` and `togglytemplate` come from that module.

```bash
go mod download
go mod verify
go test -race ./...
go vet ./...
go build ./...
```

Tests require no dashboard app, external service, or real key. They use actual clients against loopback signed fixtures, test allowed/denied branches, initial context, simultaneous alice/bob requests and variants, opposite Orders, native templates, tampering/cold failure/recovery, and refresh shutdown. CI uses placeholder configuration only.

## Manual checklist

- [ ] Start without a key and without offline mode: every section shows Missing app key; `/beta` and POST `/submit` return 404.
- [ ] Start explicit offline practice: the banner makes the local fixture source clear. Wait until a successful refresh appears.
- [ ] Home lists all sections and sixteen shared flags. Inspect the context/snapshot without seeing any app key.
- [ ] Gates shows native feature/negate/Any/All branches. Flip the fixture or dashboard flag, wait for refresh, and reload to see opposite branches.
- [ ] Matching selects alice/admin/VIP; Non-matching selects bob/user/standard, and the cookie persists across sections. A second browser can keep a different preset.
- [ ] Filters show all eleven rows with the documented device gap, stable percentage, open time window, and opposite targeted results.
- [ ] Orders shows VIP ON and standard OFF in the same request after definitions load.
- [ ] Variants display compact for alice and control for bob in offline practice. Assignment and enabled are labeled as independent reads; compact/control layout is not gated on the enabled value. Live assignments depend on your configured variant rules; the page reports unassigned/loading honestly.
- [ ] With real flags configured, toggle beta-access and enhanced-submit and observe 200/404 branches for the gate/action after refresh. The sample action saves no data.
- [ ] Refresh the JSON snapshot after a flag update. The values and refresh timestamp come from the current SDK state, not a previously selected persona.
- [ ] Stop with Ctrl+C; HTTP and all three SDK clients shut down. Confirm `.env.local` remains ignored.

Read the [Go SDK documentation](https://docs.toggly.io/sdks/go) for API guidance and the [sample contract](../docs/SAMPLE_CONTRACT.md) for catalog expectations.
