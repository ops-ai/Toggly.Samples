# Rust Axum SDK Workshop

A standalone server-rendered workshop using the published Rust core and Axum
adapter. All evaluation uses the real SDK. With no app key, an explicitly labelled
loopback service supplies ephemeral signed definitions for the same native client.
No live Toggly application is provisioned by this repository.

## Quick start

Install Rust **1.98.1** with Cargo, rustfmt and Clippy. The checked-in
`rust-toolchain.toml` selects that toolchain.

```sh
cd rust-axum-sdk
cargo test --locked
cargo run --locked
```

Open **http://localhost:8017**. The process generates an in-memory cookie key. A
new process invalidates earlier cookies. For a stable local key:

```sh
export SAMPLE_COOKIE_KEY="$(openssl rand -hex 32)"
cargo build --release --locked
./target/release/rust-axum-sdk-sample
```

The release binary binds loopback only, on port 8017, with eight Tokio worker
threads. Set `AXUM_PORT` if that port is occupied; update the manual origin recipe
if you later add browser SDK requests. A real deployment should supply its stable
session secret through its existing secure configuration system.

`.env.example` documents configuration; the app **does not load dotenv files**.
Export `TOGGLY_APP_KEY` and optional `TOGGLY_ENVIRONMENT` in your shell to connect
your own app. Empty, `placeholder`, `YOUR_APP_KEY`, and `your-app-key` select
explicit offline mode. A non-placeholder key that fails startup does **not** select
fixture data: the workshop displays an error and checks fail closed. Neither
configuration nor raw SDK errors are printed, since a transport URL can contain
an app key.

## First flag exercise

1. Start without an app key. Home shows all sixteen fixture keys and current
   decisions. The fixture enables `new-dashboard` and disables `api-v2`.
2. Open **Declarative gates**. Compare Single, Negated, Any and All results.
3. Open **Programmatic API**, then the `api-v2` JSON link. Observe a normal false
   result, an unknown key's false default, and the empty key's explicit error.
4. To experiment offline, change `new-dashboard`'s fixture filter from `AlwaysOn`
   to `AlwaysOff` in `fixtures/definitions.json`, then restart. This is a transport
   fixture edit, not a replacement evaluator. Restore it before running tests.
5. For a live exercise, follow the application recipe below, export your key and
   restart. Toggle `new-dashboard` in Production, wait up to 30 seconds and reload
   Home. Each request evaluates the latest accepted definitions.

## Published dependency boundary

| Component | Selected release |
|---|---|
| Rust stable | 1.98.1 |
| Axum | 0.7.9 |
| `toggly` | 0.6.0 |
| `toggly-axum` | 0.6.0 |

These were the latest published SDK releases and the newest Axum series the
published adapter actually supports, checked on 16 September 2026 UTC against
crates.io. Latest-host Axum is **0.8.9**. `toggly-axum` 0.6.0 declares
`axum ^0.7`. `toggly-axum08` exists in the SDK source tree as 0.1.0 and is
**not published** on crates.io. This sample therefore hosts Axum 0.7.9 with
registry packages only. Cargo.lock records normal registry checksums. There are
no local SDK paths, tarballs, dependency patches or resolver overrides.

Supporting signing dependencies match the native SDK's compatible P-256/SHA-2
generation; they do not change its signature protocol.

The customer documentation may teach newer source APIs or an Axum 0.8 adapter.
This sample documents the actual **published 0.6.0 / Axum 0.7** boundary:

- Native extractors and `TogglyLayer` look up `Extension<Arc<TogglyClient>>`, not
  `State<TogglyClient>`. The client is not Clone.
- `Feature` is a real `FromRequestParts` extractor. It reads **X-User-Id, then
  X-Identity**, with no workshop cookie, claims, groups, Order or HTTP mapper.
- `FeatureEnabled` is a public data struct, **not** a request extractor in this
  release. Comments mention `require_feature`; that function is not exported.
- `TogglyLayer::require` / `deny` evaluate header identity only. Errors become
  false and the layer returns HTTP 404 when denied. If the client extension is
  missing, the published layer **allows the request through**.
- `TogglyState::is_enabled` uses `EvalContext::default()` unless you call
  `is_enabled_with_context`.
- No native variant allocation API or Toggly template directives/macros are
  claimed. Axum routing macros belong to Axum.
- Desktop `DeviceType=Macintosh` is unsupported: the native parser returns Other
  for the exact shared Chrome/macOS User-Agent. The matrix retains the Macintosh
  recipe, displays native false and labels the gap. `OperatingSystem=Mac` works.

## Sections

| Section | URL | Teaching surface |
|---|---|---|
| Home | `/home` or `/` | Section map, 16-key checklist, native snapshot |
| Declarative gates | `/declarative` | Single, negate, Any/All, per-feature negation; unsupported variants |
| Programmatic API | `/programmatic` | Result handling, unknown/error, server-gated POST |
| Identity | `/identity` | Private-cookie persona, claims, per-request metadata |
| Order context | `/orders` | Entity key, boolean Vip, optional numeric Total |
| Filters matrix | `/filters` | Eleven unchanged shared keys and exact presets |
| Axum surfaces | `/surfaces` | Native Feature, layer, extractor, state, sample denial, lifecycle/cache |
| Configuration | `/setup` | Missing-key banner, offline/live distinction, app recipe |

All pages have Matching, Non-matching and individual context controls. Demo
personas are **not authentication or authorization**. Workshop cookies are
AES-GCM private cookies; POST requests also verify a CSRF token, validate fields
and restrict redirect targets. HTML escapes all dynamic input.
In a real app, derive identity, claims and proxy metadata from trusted server
sources. Never treat a feature flag as the sole access-control boundary.

## Exact application and flag recipe

Use the reviewed [shared application setup guide](../docs/APP_SETUP.md)
for picker names, context registration, single-feature management API fallback
when the catalog omits a filter, and the required **final save, definitions
request and saved readback** checks. This is a manual recipe; no live creation,
flag readback or service acceptance has been performed for this sample.

- Workspace: use one you can manage (the one from signup is enough).
- Application: **Rust Axum SDK Sample**.
- Technology: **Rust**.
- Environment: **Production**.
- Local URL: **http://localhost:8017**. Server-only SDK evaluation does not need
  browser origins. If adding direct browser SDK calls, configure that origin and
  **http://127.0.0.1:8017** when used, following the shared guide.
- Context kind: **Order**; key property **Id**, type string; **Vip**, boolean;
  **Total**, number, optional. Id is sent as the native entity key. Missing Total
  remains absent, not guessed or converted to a string.

Create the five demo flags:

| Key | Recipe |
|---|---|
| `new-dashboard` | Baseline environment toggle; begin on |
| `api-v2` | Baseline environment toggle; begin off to contrast Any/All |
| `enhanced-submit` | Baseline environment toggle; begin on |
| `ExpressCheckout` | Bind Order; ContextProperty Vip equals boolean true |
| `beta-access` | Baseline environment toggle; begin on |

Create a **Filters** category and all eleven flags from
[FLAG_TEMPLATE.md](../docs/FLAG_TEMPLATE.md):

| Key | Exact filter | Matching / Non-matching |
|---|---|---|
| `filter-always-on` | AlwaysOn | On / on |
| `filter-percentage` | Percentage 50%, sticky by identity | Neither result prescribed |
| `filter-targeting` | Targeting users=alice | On / off |
| `filter-user-claims` | UserClaims role=admin | On / off |
| `filter-time-window` | TimeWindow 2020 through 2099 | On / on while open |
| `filter-country` | Country US | On / off |
| `filter-browser-family` | BrowserFamily Chrome | On / off |
| `filter-browser-language` | BrowserLanguage en | On / off |
| `filter-device-type` | DeviceType Macintosh | Native gap: off / off |
| `filter-os` | OperatingSystem Mac | On / off |
| `filter-context-property` | Bind Order; ContextProperty Vip=true | On / off |

The native wire fixture uses indexed HTTP segment parameters and Percentage=100
inside those segment filters. This encodes the shared recipe; it does not change
the dedicated sticky Percentage flag's 50% value.

| Input | Matching | Non-matching |
|---|---|---|
| Identity | alice | bob |
| Claim | role=admin | role=user |
| Country | US | CA |
| Accept-Language | en-US,en;q=0.9 | fr-FR,fr;q=0.9 |
| User-Agent | Chrome 120 / macOS 10.15.7 | Firefox 121 / Windows 10 |
| Order | ord-vip, Vip=true, Total=40 | ord-standard, Vip=false, Total=40 |

The exact shared User-Agent strings are in `src/context.rs`. The extra
`ord-high-value` is non-VIP with Total=250; `ord-no-total` omits Total. Keep
identity fixed while switching Order to demonstrate user/entity separation.

Local schema registration runs before constructing the SDK client. Published
0.6.0 performs the remote catalog PUT during construction, **before**
`initialize()` fetches definitions. Transport errors are ignored. Manually save
the remote Order binding before testing the live flag; do not assume startup
makes a missing remote rule immediately valid.

The Rust dashboard picker still omits Percentage, Targeting and TimeWindow. Use
the shared [management API procedure](../docs/APP_SETUP.md#when-a-filter-is-missing-from-the-picker)
with this sample's verified native parameter form.

## Native behavior and lifetime

The process constructs one client and awaits initial signed definitions before
serving. Every request builds its complete `EvalContext` first. No request mutates
global identity, constructs a client, refreshes definitions or clears caches.
The native Feature route reads **X-User-Id, then X-Identity**, with no workshop
cookie, claims, groups, Order or HTTP mapper. Try:

```sh
curl -H 'X-User-Id: alice' -H 'X-Identity: bob' http://localhost:8017/native
curl 'http://localhost:8017/api/check?key=ExpressCheckout'
curl 'http://localhost:8017/api/check?key=not-in-the-catalog'
curl 'http://localhost:8017/api/check?key='
```

The core default returns false for unknown keys; an empty key produces an error.
The native extractor suppresses evaluation errors as false and returns HTTP 500 if
the client extension is absent. The sample beta route instead resolves full
context and returns 404 for off, 503 for error. Enhanced submit re-checks CSRF
and its flag on the POST; it changes no business data.

`evaluate_gate` negates **each feature before** Any/All aggregation in 0.6.0. It
does not negate the aggregate. An empty gate returns false. Multi-key checks and
Home rows are separate native evaluations, not an atomic all-flags revision.
Each displayed boolean/error pair comes from one native call; no invented SDK
reason is attached to another evaluation.

The default 60-second evaluation cache key omits Order, claims and request
metadata. This interactive workshop uses public `cache_ttl(Duration::ZERO)` for
immediate expiry when users change those values while retaining identity. Entries
are still created; expiry compares the runtime clock to the expiry instant. This
is **not structural cache disabling**. Native concurrent-thread and production
HTTP tests verify the workshop configuration. The downloaded definition cache
remains shared and is not cleared on requests.

Native polling runs every 30 seconds live and 2 seconds offline. A failed poll
retains the last accepted definitions and displays a redacted refresh warning;
raw errors and app-key-bearing URLs are never shown. A subsequent successful poll
updates future requests. Published 0.6.0 rejects a signed document whose
timestamp is not newer than the last accepted one, so fixture replacements in
tests wait for the next second. Axum graceful shutdown calls `close`; the
loopback fixture remains alive until shutdown finishes, then its owned thread is
joined.

## Source-reading map

| File | Start here to understand |
|---|---|
| `src/lib.rs` | Configuration, initial fetch, shared client, shutdown layers |
| `src/context.rs` | Context before evaluation, private cookies, Order schema |
| `src/routes.rs` | One-call decisions, native Feature/layer/state, composed denials/actions |
| `src/views.rs` | Server-rendered gates, sections, escaping and teaching |
| `src/catalog.rs` | Exact 16 keys and 11 matrix rows |
| `src/fixture.rs` | Loopback transport, ephemeral signing, refresh controls |
| `fixtures/definitions.json` | Actual native wire filters, no evaluator replacement |
| `tests/native.rs` | Published SDK integration, lifecycle, failures and concurrency |
| `scripts/http_smoke.py` | Real release Axum host and eight isolated sessions |

Fixture signatures preserve the platform protocol: raw definitions plus timestamp,
SHA-256 prehash then ECDSA over SHA-256(prehash), with ES256/P1363 signature bytes
and the matching SHA-1-derived public key id. The private key exists only in
memory. This sample does not patch or replace native signature verification.

## Docs notes for the separate Docs slice

Checked against [docs.toggly.io/sdks/rust](https://docs.toggly.io/sdks/rust) and
the published 0.6.0 crate sources on 16 September 2026:

- Customer docs should teach Axum 0.7 + published `toggly-axum` 0.6.0, or clearly
  mark any Axum 0.8 / `toggly-axum08` material as unpublished source.
- `FeatureEnabled` must not be documented as a working extractor until it
  implements `FromRequestParts`.
- `TogglyLayer` fail-open when the client extension is missing should be stated.
- Header precedence is X-User-Id then X-Identity, matching the published crate.

## Verification

```sh
cargo fmt --check
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
cargo build --release --locked
python3 scripts/http_smoke.py
```

The five integration tests cover signed initial definitions, all matrix rows,
context before first evaluation, absent/empty keys, Order changes/optional Total,
Any/All/negation, native header precedence, native layer/extractor/state, missing
extension, denied routes/actions, CSRF/validation/escaping, captured schema PUT,
signed tampering, transport failure, retained definitions, actual background
changes and close. Eight threads overlap 7,200 same-identity Order/claims/country
checks. The release HTTP smoke uses eight workers and independent cookie jars,
800 same-identity snapshots and 2,400 Order/claims/country assertions; it also
walks all eight sections and matching/non-matching presets, then verifies clean
shutdown. CI runs the same commands on Linux using only placeholders and local
fixtures.

Tests require loopback socket access. When a sandbox blocks sockets or a proxy
intercepts localhost, run in a permitted local environment and set
`NO_PROXY=127.0.0.1,localhost`. Do not substitute mocked outcomes for blocked
native checks. `scripts/http_smoke.py --output /path/to/evidence` preserves its
log and structured result; no keys are written there.

## Manual checklist

- [ ] No app key: all eight sections render with the offline banner.
- [ ] At desktop and mobile widths, navigation, forms and matrix are readable;
      keyboard focus is visible and Skip to content works.
- [ ] Matching/non-matching show the table expectations and explicit Macintosh gap.
- [ ] Keep alice; switch VIP/standard Order and admin/user role without stale results.
- [ ] Two browser profiles retain independent contexts.
- [ ] Any/All and both negation modes match the native semantics described above.
- [ ] Unknown key is off; empty key is an error; beta/action denial is server-side.
- [ ] Native header extractor shows alice over bob and remains separate from cookies.
- [ ] Follow the manual application recipe, save every flag/context, request
      definitions and read back the final values before claiming live acceptance.
- [ ] Live flag edit appears after polling and reload; service failure retains
      accepted definitions with a warning; restart errors do not select fixtures.
- [ ] Stop the host and confirm the Toggly close-hook message.
