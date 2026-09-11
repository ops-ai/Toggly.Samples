# Ruby SDK Sample

A standalone Ruby/Rack workshop using the published `toggly` gem. Explore native
feature evaluation with per-request identity, HTTP headers and Order entities;
compose the results in plain ERB. This is not a Rails adapter sample.

## Quick start

Install **Ruby 4.0.6** and a native compiler toolchain for Puma's dependency.
From this folder:

```sh
gem install bundler -v 4.0.20
bundle config set --local frozen true
bundle install
bundle exec rake test build
bundle exec puma -e production -C config/puma.rb
```

Open [localhost:9292](http://localhost:9292). Without an app key, every page shows
**No app key — offline defaults**. All sixteen flags default OFF; no definitions
request or native telemetry runtime starts. The UI stays usable.

To exercise real native rules without any account, key or live service:

```sh
bundle exec ruby script/demo.rb
```

Stop the earlier server first. This command starts a deterministic loopback
fixture and the same production Puma app. Its identifier `local-fixture` belongs
only to that local test server; it is not a Toggly key. The banner explicitly
labels this mode. Type `dashboard off` or `dashboard on` in its terminal to
change native definitions, or `quit` to stop both owned processes.

To connect your own application, set server environment variables and restart:

```sh
export TOGGLY_APP_KEY='your-application-key'
export TOGGLY_ENVIRONMENT=Production
bundle exec puma -e production -C config/puma.rb
```

`.env.example` documents the supported settings. The sample reads process
environment variables; it does not automatically load a `.env` file. Never put a
real key in a committed file or browser variable. A connected key fetches live
definitions, but **telemetry still uses local capture and is never delivered to
Toggly by this sample**.

## Your first flag

1. Start with no key and inspect the visible OFF fallback on **Declarative gates**.
2. Start the local fixture, or configure `new-dashboard` in your own app.
3. In fixture mode, type `dashboard off`. With your own app, turn the baseline
   flag off and complete the normal final Save/approval flow.
4. The SDK polls every ten seconds by default (two in the fixture demonstration).
   Home's sixteen-row snapshot reevaluates every three seconds. Reload the gates
   page to see its server-rendered branch change.
5. Turn it back on. Read `lib/feature_service.rb`, then `views/gates.erb`: the
   native check returns a boolean; ERB composes the visible result.

## Versions and commands

Latest stable versions checked against official Ruby downloads and RubyGems on
September 10, 2026 (September 11 UTC):

| Component | Locked version |
|---|---|
| Ruby | 4.0.6 |
| Toggly core (`toggly`) | 0.5.0 |
| Rack / Rackup | 3.2.7 / 2.3.1 |
| Puma | 8.0.2 |
| Rack Session | 2.1.2 |
| Bundler | 4.0.20 |
| Minitest / Rake | 6.0.6 / 13.4.2 |

The lock includes checksums and generic Ruby, macOS and Linux platforms. A normal
frozen install consumes published gems; no local SDK checkout or patched artifact
is used. A Ruby app has no browser bundling step: `rake build` compiles Ruby and
ERB syntax, then renders all eight pages using the actual production Rack app.

```sh
bundle exec rake test
bundle exec rake build
bundle exec ruby script/production_smoke.rb
```

Tests use the actual SDK and a local HTTP definitions fixture. The external smoke
starts the real Puma CLI, checks allowed/denied HTTP and action paths, CSRF,
24 isolated sessions, same-user Order changes, native polling, outage/restart
restoration, missing-key pages and SIGTERM cleanup. It requires loopback sockets
and no live application or external database. CI runs these commands on Linux.

## Section map

| Section | What to try | Read next |
|---|---|---|
| Home | Sixteen flags, current snapshot and first exercise | `views/home.erb`, `views/snapshot.erb` |
| Declarative gates | Native enabled/disabled; sample Any/All ERB; variant limit | `views/gates.erb` |
| Programmatic API | `/api/v2`, `/beta`, CSRF-protected demo submission | `app.rb`, `views/api.erb` |
| Identity | Matching/Non-matching, editable persona, actual headers | `lib/request_context.rb` |
| Order context | VIP versus standard Order for the same identity | `views/orders.erb` |
| Filter matrix | Eleven native rows and honest limitations | `lib/catalog.rb`, `test/fixtures/definitions.json` |
| Native surfaces | Diagnostics, refresh, snapshot, usage and metrics | `lib/feature_service.rb`, `lib/local_telemetry.rb` |
| Configuration | Keyless behavior and manual application setup | `lib/configuration.rb`, `.env.example` |

## Context and lifecycle

`config.ru` constructs one client in one serving process. Its initial fetch is
synchronous, bounded by the native three-second HTTP timeout setting. That
request fetches app/environment definitions; user identity is supplied separately
before each evaluation, not to the client constructor.

Each HTTP request builds a fresh immutable `Toggly::Context` from its own signed
Rack session. `HttpRequestMapper.merge_into` maps country, User-Agent and language.
The mapper does not invent identity or claims. Choose **Actual request headers**
to exercise Rack `HTTP_*` normalization; otherwise the exact demo inputs are used.
Treat forwarding headers as trusted only behind a controlled proxy in a real app.

Demo identities and role claims are editable teaching inputs, not authentication.
CSRF tokens protect changes to the demo session and actions. Real authorization
must remain independent of feature flags. Session cookies are HTTP-only and
SameSite=Lax; the local HTTP default does not use Secure. Set
`SESSION_COOKIE_SECURE=true` when serving through HTTPS. An omitted
`SESSION_SECRET` generates ephemeral process-local signing material, so sessions
reset on restart. Supply at least 64 bytes through your normal runtime environment
when session continuity is needed; no signing secret is persisted by this sample.

Order is a native `EntityContext`, not a trait substitute. A startup
`register_context('Order')` mapper turns a domain Order into `kind`, `key` and
attributes. A request calls `with_entity(map_entity(...))`. Changing an Order
preserves the user's identity. Decisions are not cached with `Context#cache_key`,
which does not include entity data or definition revisions.

Puma explicitly uses `workers 0` and 1–8 threads. Do not add worker forks or preload
an initialized SDK client without designing and testing per-worker ownership.
`at_exit` closes the native client outside the signal trap, stops refresh and
flushes/closes started telemetry. Puma's `after_stopped` callback can run inside
the SIGTERM trap, where native telemetry mutexes cannot be used. Puma's default
graceful SIGTERM status is signal15 rather than exit0; the smoke checks and records
that actual status. SIGKILL/crash cleanup and clustered deployment are not claimed.

## Native APIs and composition boundaries

- `enabled?(key, context:)` supplies default handling and automatic native usage
  checks. `disabled?` negates it. Undefined flags default false in every mode.
- `evaluate(key, context:)` supplies diagnostics. It does not apply the enabled
  fallback or record the same automatic usage check.
- ERB conditions, Any/All, HTTP gates and CSRF are sample composition. Core Ruby
  has no Rack middleware or template tag API. All multi-key checks are evaluated
  before combining them, avoiding short-circuited usage reporting.
- **No native variant allocation API exists in core0.5.0.** The variant section
  explains this openly. The `variant:` telemetry parameter is caller-supplied
  labeling, not assignment; no substitute allocation is invented.
- `SnapshotProviders::File.new(path: ...)` atomically saves native definitions.
  Default storage under ignored `tmp/` is namespaced by a hash of app/environment.
  Restored values can evaluate while native `ready` is **false** after a failed
  initial fetch. UI shows actual readiness separately from evaluated values.
  Later failed polls keep the last available definitions.
- `refresh(force: true)` is exposed by a CSRF-protected form. Native background
  polling runs at `TOGGLY_REFRESH_INTERVAL`; changing request context does not
  fetch definitions. The three-second browser snapshot loop is separate from
  definition polling and aborts on navigation.
- `record_usage`, `record_view`, `measure`, `increment_counter`, `observe`,
  `flush_telemetry` and `close` are real native calls. A public injected transport
  counts usage/metric batches in memory, without retaining payloads. With no key
  the native SDK does not start telemetry, so those counts remain zero. Connected
  and fixture modes capture locally; nothing is sent remotely.

The SDK's default remote telemetry path uses optional `grpc` and
`google-protobuf` packages. To build a separate remotely reporting application,
install and lock those dependencies, omit `usage_client`/`metrics_client` from
`Toggly::Client.new`, and use the native enabled flags/flush configuration with
your application key. This sample deliberately installs neither transport package
and does not verify remote delivery. Without them, the native default transport
cannot send; local captured batches must not be interpreted as delivery.
Optional WebSocket support also is not installed here; this sample uses polling.

## Manual Toggly application setup

Use the [shared setup guide](https://github.com/ops-ai/Toggly.Samples/blob/07c4c663ba95b6bb7f1c17e9e04d0fc95323b779/docs/APP_SETUP.md)
with these exact values:

| Setting | Value |
|---|---|
| Workspace | Toggly Samples |
| Application | Ruby SDK Sample |
| Technology label / key | Ruby on Rails / `ruby-on-rails` |
| Environment | Production |
| Application URL | `http://localhost:9292` |

The technology picker groups standalone Ruby with Rails; this application itself
uses plain Rack. Keep the correct technology. Server-only apps may not display
Allowed Web Origins; do not enable browser access simply to reveal that control.

Create context kind **Order** with `Id` string as key property, `Vip` boolean,
and optional `Total` number. Bind **ExpressCheckout** and
**filter-context-property** to Order. No other sample flag gets that binding.
Create these exact sixteen keys; put the eleven `filter-*` keys in **Filters**.

| Key | Rule / native parameters |
|---|---|
| `new-dashboard` | Baseline AlwaysOn when enabled; empty rule list when disabled |
| `api-v2` | Baseline AlwaysOn / empty list |
| `enhanced-submit` | Baseline AlwaysOn / empty list |
| `beta-access` | Baseline AlwaysOn / empty list |
| `ExpressCheckout` | ContextProperty: `Property: Vip`, `Operator: eq`, `Value: true` (string), `ValueType: boolean`; Order binding |
| `filter-always-on` | AlwaysOn, no parameters |
| `filter-percentage` | Percentage: `Value: 50` |
| `filter-targeting` | Targeting: `"Audience.Users:0": "alice"` |
| `filter-user-claims` | UserClaims: `Claim: role`, `Value: admin`, `Percentage: 100` |
| `filter-time-window` | TimeWindow: `Start: 2020-01-01T00:00:00Z`, `End: 2099-12-31T23:59:59Z` |
| `filter-country` | Country: `"Country:0": "US"`, `Percentage: 100` |
| `filter-browser-family` | BrowserFamily: `"BrowserFamily:0": "Chrome"`, `Percentage: 100` |
| `filter-browser-language` | BrowserLanguage: `"BrowserLanguage:0": "en"`, `Percentage: 100` |
| `filter-device-type` | DeviceType: `"DeviceType:0": "Macintosh"`, `Percentage: 100` |
| `filter-os` | OperatingSystem: `"OperatingSystem:0": "Mac"`, `Percentage: 100` |
| `filter-context-property` | Same sole ContextProperty rule and Order binding as ExpressCheckout |

Each filter flag retains only its intended rule. Remove an initial AlwaysOn row
when adding an Order condition. Do not add a fallback rule to force expected
negative results. The fixture file records exact published-SDK wire input with
quoted indexed keys and boolean-value type metadata.

The platform picker may omit Percentage, Targeting or TimeWindow for this
technology. Follow the shared guide's existing authorized management-client
procedure. Read and replace only the dedicated feature/environment's whole rule
list; SDK app keys are not management authorization. For example, the **management
PUT body** for `filter-targeting` is an array, not an SDK definitions envelope:

```json
[
  {
    "name": "Targeting",
    "parameters": {
      "Audience.Users:0": "alice"
    }
  }
]
```

For `filter-percentage`, use the sole `Percentage` rule with `{"Value": 50}`;
for `filter-time-window`, use the exact ISO timestamps above. In management's
scalar `Audience.Users` field, values are stored application-list IDs. Do not put
literal `alice` there. The indexed key above is the Ruby-native literal identity
form. Read back the applied definition/rule values after normal approvals.

**Save conditions** stages the editor change. Then use outer **Save Changes** or
**Request Changes**, review the confirmation, and select **Save** or **Request**.
Complete any approval workflow and reopen/read back actual applied rules; HTTP200
alone may still describe a pending change. No live provisioning is performed by
this sample or its deterministic tests.

## Exact presets and native limitations

| Input | Matching | Non-matching |
|---|---|---|
| Identity / claim | alice / role=admin | bob / role=user |
| Country | US | CA |
| Accept-Language | en-US,en;q=0.9 | fr-FR,fr;q=0.9 |
| Order | ord-vip, Vip=true, Total149.95 | ord-standard, Vip=false, Total20 |
| User-Agent | Chrome120 on macOS10.15.7 (exact string below) | Firefox121 on Windows10 (exact string below) |

```text
Matching: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Non-matching: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0
```

Against the exact sole-rule fixture, claims/country/browser/language/OS/Order
rows produce ON/OFF. AlwaysOn and the open TimeWindow produce ON/ON. Percentage
is sticky but does not promise opposite outcomes for the two identities.
**Native Targeting produces ON/ON** for these sole-rule definitions; it does not
demonstrate the intended negative. **Native DeviceType produces OFF/OFF** because
the exact Macintosh user agent maps to Other. Preserve Macintosh device and Mac
operating-system values; the UI reports native results without replacement rules
or evaluators. Live values depend on your actual applied definitions.

## Manual checklist

- [ ] Start keyless: all eight sections render, banner visible, sixteen OFF defaults.
- [ ] Start fixture or your configured app; toggle new-dashboard and inspect the
      automatic Home snapshot and reloaded declarative branches.
- [ ] Exercise feature/negate/Any/All and read the explicit variant limitation.
- [ ] Observe allowed and denied `/api/v2`, `/beta`, and submission responses.
- [ ] Apply both presets in different browser sessions; identity and Order stay
      isolated. Missing CSRF is denied; invalid values do not alter the session.
- [ ] Keep alice fixed while switching VIP and standard Orders; both entity flags
      reevaluate without stale results.
- [ ] Check all eleven rows, including the native Targeting/DeviceType limitations.
- [ ] Submit and flush telemetry; counts are local batches, never delivery proof.
- [ ] Stop with SIGTERM and inspect native cleanup. Run the production smoke for
      automatic outage/restart verification and honest signal exit reporting.
- [ ] For a live app, read back all sixteen keys, Production rules, Order bindings
      and final approvals. Local tests do not establish live provisioning.
