# Rust Actix SDK Workshop

A standalone server-rendered workshop using the published Rust core and Actix
adapter. All evaluation uses the real SDK. With no app key, an explicitly labelled
loopback service supplies ephemeral signed definitions for the same native client.
No live Toggly application is provisioned by this repository.

## Quick start

Install Rust **1.98.1** with Cargo, rustfmt and Clippy. The checked-in
`rust-toolchain.toml` selects that toolchain.

```sh
cd rust-actix-sdk
cargo test --locked
cargo run --locked
```

Open **http://localhost:8018**. The process generates an in-memory cookie key. A
new process invalidates earlier cookies. For a stable local key:

```sh
export SAMPLE_COOKIE_KEY="$(openssl rand -hex 64)"
cargo build --release --locked
./target/release/rust-actix-sdk-sample
```

The release binary binds loopback only, on port 8018, with eight Actix workers.
Set `ACTIX_PORT` if that port is occupied; update the manual origin recipe if you
later add browser SDK requests. A real deployment should supply its stable
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
| Actix-web | 4.15.0 |
| `toggly` | 0.6.1 |
| `toggly-actix` | 0.6.1 |

These were the latest published SDK releases and the newest Actix-web series the
published adapter actually supports, checked on 16 September 2026 UTC against
crates.io. `toggly-actix` 0.6.1 declares `actix-web >=4.4, <4.16`. This sample
hosts Actix-web **4.15.0** with registry packages only. Cargo.lock records normal
registry checksums. There are no local SDK paths, tarballs, dependency patches
or resolver overrides.

Supporting signing dependencies match the native SDK's compatible P-256/SHA-2
generation; they do not change its signature protocol.

This sample documents the actual **published 0.6.1 / Actix-web 4.15** boundary:

- Native extractors, middleware and `FeatureGuard` look up
  `web::Data<TogglyClient>`, not `Data<Arc<TogglyClient>>`. The client is not
  Clone; clone the Data handle into Actix workers.
- `Feature` is a real `FromRequest` extractor. It reads **X-User-Id, then
  X-Identity**, with no workshop cookie, claims, groups, Order or HTTP mapper.
- `FeatureEnabled` is a public data struct, **not** a request extractor in this
  release.
- `TogglyMiddleware::with_feature` evaluates one configured identity header
  (`identity_header`). There are no `require` / `deny` factory methods. Errors
  become false and denied checks return HTTP 404. If client Data is missing, the
  published middleware **allows the request through**.
- `TogglyData` unwraps the same Data and evaluates with the caller-supplied
  context. Both `Feature` and `TogglyData` **panic** if client Data is missing;
  this workshop checks first and returns HTTP 500.
- `FeatureGuard` is a **definition-existence** guard (`is_defined_sync`). A
  defined flag whose condition is false still matches. `disabled` inverts
  existence, not asynchronous off-state evaluation. Missing client Data fails
  the guard.
- No native variant allocation API or Toggly template directives/macros are
  claimed. Actix routing macros belong to Actix.
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
| Actix surfaces | `/surfaces` | Native Feature, middleware, TogglyData, FeatureGuard, sample denial |
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
- Application: **Rust Actix SDK Sample**.
- Technology: **Rust**.
- Environment: **Production**.
- Local URL: **http://localhost:8018**. Server-only SDK evaluation does not need
  browser origins. If adding direct browser SDK calls, configure that origin and
  **http://127.0.0.1:8018** when used, following the shared guide.
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
0.6.1 performs the remote catalog PUT during construction, **before**
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
curl -H 'X-User-Id: alice' -H 'X-Identity: bob' http://localhost:8018/native
curl 'http://localhost:8018/api/check?key=ExpressCheckout'
curl 'http://localhost:8018/api/check?key=not-in-the-catalog'
curl 'http://localhost:8018/api/check?key='
```

The core default returns false for unknown keys; an empty key produces an error.
The native extractor suppresses evaluation errors as false. This sample returns
HTTP 500 if client Data is absent rather than letting published extractors panic.
The sample beta route instead resolves full context and returns 404 for off, 503
for error. Enhanced submit re-checks CSRF and its flag on the POST; it changes
no business data.

`evaluate_gate` negates **each feature before** Any/All aggregation in 0.6.1. It
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
updates future requests. Published 0.6.1 rejects a signed document whose
timestamp is not newer than the last accepted one, so fixture replacements in
tests wait for the next second. Actix graceful shutdown calls `close`; the
loopback fixture remains alive until shutdown finishes, then its owned thread is
joined.

## Source-reading map

| File | Start here to understand |
|---|---|
| `src/lib.rs` | Configuration, initial fetch, shared client, Actix middleware |
| `src/context.rs` | Context before evaluation, private cookies, Order schema |
| `src/routes.rs` | One-call decisions, native Feature/middleware/data, composed denials |
| `src/views.rs` | Server-rendered gates, sections, escaping and teaching |
| `src/catalog.rs` | Exact 16 keys and 11 matrix rows |
| `src/fixture.rs` | Loopback transport, ephemeral signing, refresh controls |
| `fixtures/definitions.json` | Actual native wire filters, no evaluator replacement |
| `tests/native.rs` | Published SDK integration, lifecycle, failures and concurrency |
| `scripts/http_smoke.py` | Real release Actix host and eight isolated sessions |

Fixture signatures preserve the platform protocol: raw definitions plus timestamp,
SHA-256 prehash then ECDSA over SHA-256(prehash), with ES256/P1363 signature bytes
and the matching SHA-1-derived public key id. The private key exists only in
memory. This sample does not patch or replace native signature verification.

## Docs notes for the separate Docs slice

Checked against [docs.toggly.io/sdks/rust](https://docs.toggly.io/sdks/rust),
[docs.toggly.io/sdks/rust/actix](https://docs.toggly.io/sdks/rust/actix) and the
published 0.6.1 crate sources on 16 September 2026:

- Customer Actix docs already teach Actix-web 4.4–4.15, `web::Data<TogglyClient>`,
  Feature header precedence, middleware `with_feature` / `identity_header`, and
  FeatureGuard as definition existence. Keep those accurate for 0.6.1.
- crates.io crate-level example still shows `TogglyClient::builder()` plus
  `client.clone()` and treats `FeatureGuard` as a feature-enabled route gate.
  Customer docs correctly say the client is not Clone and FeatureGuard is
  existence-only. Align the crate README example with the customer page.
- docs.rs labels `FeatureEnabled` as an extractor; it does not implement
  `FromRequest` in 0.6.1.
- Document that published `Feature` and `TogglyData` panic when Data is missing,
  while `TogglyMiddleware` fail-opens and `FeatureGuard` fail-closes.
- Middleware reads only its configured identity header. It does not fall back to
  X-Identity the way `Feature` does.

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
Any/All/negation, native header precedence, native middleware/extractor/app data,
FeatureGuard existence versus evaluation, missing Data, denied routes/actions,
CSRF/validation/escaping, captured schema PUT, signed tampering, transport
failure, retained definitions, actual background changes and close. Eight threads
overlap 7,200 same-identity Order/claims/country checks. The release HTTP smoke
uses eight workers and independent cookie jars, 800 same-identity snapshots and
2,400 Order/claims/country assertions; it also walks all eight sections and
matching/non-matching presets, then verifies clean shutdown. CI runs the same
commands on Linux using only placeholders and local fixtures.

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
- [ ] FeatureGuard still matches a defined AlwaysOff flag; middleware does not.
- [ ] Follow the manual application recipe, save every flag/context, request
      definitions and read back the final values before claiming live acceptance.
- [ ] Live flag edit appears after polling and reload; service failure retains
      accepted definitions with a warning; restart errors do not select fixtures.
- [ ] Stop the host and confirm the Toggly close-hook message.
