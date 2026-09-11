# Ruby Rails SDK Sample

A native, server-rendered Rails workshop using the published `toggly-rails`
Railtie and `toggly` core. Explore controller and view gates, encrypted browser
sessions, immutable Order context, all sixteen shared flags and eleven filters.
No database, mail service, JavaScript framework or external service is needed
for the local fixture demonstration.

## Quick start

Install Ruby **4.0.6** and a native compiler toolchain, then from this folder:

```sh
gem install bundler -v 4.0.16
bundle config set --local frozen true
bundle install
bundle exec rails test
bundle exec puma -C config/puma.rb
```

Open [localhost:3007](http://localhost:3007). With no app key, every page displays
**No app key — offline defaults**, all sixteen defaults are OFF, and the context
controls remain usable. Stop Puma with Ctrl-C before launching another host.

To exercise native SDK rules without an account or live key:

```sh
bundle exec ruby script/demo.rb
```

This starts a loopback definitions fixture and the actual production Rails/Puma
host, compiles Propshaft assets, and displays a **Local fixture demo** banner.
`local-fixture` is an identifier belonging only to that test server, not a real
Toggly key. Type `dashboard off` or `dashboard on` in its terminal to change the
fixture; `quit` or Ctrl-C stops both owned hosts. Temporary session material and
snapshot storage are discarded when this demonstration stops.

For your own application, export server-only variables and restart:

```sh
export TOGGLY_APP_KEY='your-application-key'
export TOGGLY_ENVIRONMENT=Production
bundle exec puma -C config/puma.rb
```

The app reads process environment variables. `.env.example` is a reference, not
an automatically loaded file. If you create your own ignored `.env`, load it in
your shell with `set -a`, `. ./.env`, then `set +a` before starting the host.
Never put keys in browser code, URLs or source control. A configured key does not
prove a successful fetch: native readiness, current evaluations and server logs
are separate evidence.

## Your first flag

1. With no key, open Declarative gates and see the classic dashboard fallback.
2. Start the local fixture demo, or create `new-dashboard` in your dedicated app.
3. In fixture mode type `dashboard off`; for your own app turn the baseline flag
   off and complete the normal final Save/approval flow.
4. The SDK polls every ten seconds by default. Home requests fresh server-side
   evaluations every five seconds; this browser polling is not an SDK push API.
5. Reload Declarative gates to see the captured native disabled block. Turn the
   flag back on, then inspect the initializer and gate template linked below.

## Versions and verification

Official Ruby downloads and RubyGems metadata checked September 10, 2026
(September 11 UTC):

| Component | Selected version |
|---|---|
| Ruby | 4.0.6 |
| Rails | 8.1.3.1 |
| `toggly-rails` / `toggly` | 0.2.1 / 0.5.0 |
| Puma / Rack | 8.0.2 / 3.2.7 |
| Propshaft | 1.3.2 |
| JSON | 2.21.2, explicit `>= 2, < 3` |
| Bundler lock format producer | 4.0.16 |

Rails 8.1 calls `JSON.parse` with positional options in native encrypted-cookie
metadata decoding. JSON 3 requires keyword options; the explicit compatible JSON
bound keeps that native path working. ActiveSupport's declared `json >= 0`
constraint permits JSON 2.21.2. This is ordinary published dependency resolution,
with the latest stable Rails/runtime and published Toggly packages retained.
No SDK patch, serializer downgrade or dependency bypass is used.

The checksum-bearing lock includes generic Ruby, macOS and Linux platforms.
Verification uses native Rails integration tests and an actual external Puma
process, with deterministic loopback definitions only:

```sh
bundle check
bundle exec rails test
bundle exec rails zeitwerk:check
RAILS_ENV=production SECRET_KEY_BASE_DUMMY=1 bundle exec rails assets:precompile
bundle exec ruby script/production_smoke.rb
```

The smoke checks production pages and digested assets, native HTML/JSON/action
gates, CSRF, 24 isolated sessions, same-user Order changes, background polling,
Rails FileStore snapshot restore during outage, missing-key pages and Railtie
SIGTERM cleanup. It requires permission to bind loopback sockets. CI runs the
same checks on Linux. A real deployment is not part of this local teaching app.

For a manual production-mode launch after precompilation:

```sh
export RAILS_ENV=production
export SECRET_KEY_BASE="$(bundle exec ruby -rsecurerandom -e 'puts SecureRandom.hex(64)')"
bundle exec puma -e production -C config/puma.rb
```

`SECRET_KEY_BASE_DUMMY=1` is for build/test operations, not a deployed session
secret. Keep production material in your normal runtime environment. Local HTTP
cookies are HttpOnly and SameSite=Lax; a deployed application needs HTTPS,
secure cookies and real authentication. Demo claims are deliberately editable
teaching data, and feature gates do not replace authorization.

## Section and source map

| Section | What to try | Read next |
|---|---|---|
| Home | Sixteen flags, first exercise, live snapshot | [home.html.erb](app/views/showcase/home.html.erb), [snapshot.js](app/assets/javascripts/snapshot.js) |
| Declarative gates | Native block captures, negate, value switch, Any/All, variant limit | [gates.html.erb](app/views/showcase/gates.html.erb) |
| Programmatic API | `/api/v2`, `/beta`, CSRF-protected session action | [actions_controller.rb](app/controllers/actions_controller.rb) |
| Identity | Presets, editable persona/claims, actual HTTP headers | [request_context.rb](app/services/request_context.rb), [context_controller.rb](app/controllers/context_controller.rb) |
| Order context | Same user with `ord-vip` and `ord-standard` | [order.rb](app/models/order.rb), [orders.html.erb](app/views/showcase/orders.html.erb) |
| Filter matrix | Eleven native rows, reference and current evaluations | [catalog.rb](app/services/catalog.rb), [definitions.json](test/fixtures/definitions.json) |
| Native surfaces | Railtie, cache snapshots, polling, CLI, lifecycle | [toggly.rb](config/initializers/toggly.rb), [sdk.html.erb](app/views/showcase/sdk.html.erb) |
| Configuration | Visible missing-key behavior and app recipe | [.env.example](.env.example), [setup.html.erb](app/views/showcase/setup.html.erb) |

## Request context and lifecycle

The published Railtie adds controller/view helpers and native context-cleanup
middleware. `ApplicationController` prepends session setup before the SDK's
context callback, then the configured builder constructs a new immutable native
`Toggly::Context`. The controller explicitly exposes `toggly_context` to its
teaching views using Rails `helper_method`; the adapter automatically exposes
its feature helpers. Identity and role claims remain request-scoped; no global
client identity is mutated or process client reconfigured during a request.

The native HTTP mapper reads either the exact shared preset values or actual
Rails request headers. In a real app, trust forwarded country headers only from
controlled infrastructure. A plain immutable `Order` creates a native entity:
`kind: 'Order'`, key from `Id`, and boolean `Vip` plus numeric `Total` attributes.
`with_entity` compares another Order while preserving identity and claims.
Native context cache keys omit entity data and definition revisions, so this
sample never caches evaluated decisions using those keys.

One initializer configures one client. Puma uses `workers 0` and 1–4 threads:
do not fork an initialized SDK. The native Railtie owns `at_exit` cleanup. The
external smoke observes that native close after real SIGTERM; Puma's normal
terminal status is signal 15, not process exit 0. SIGKILL/crashes do not execute
`at_exit`. Reloading is disabled in this workshop so the startup client remains
stable; restart after changing Ruby code or environment variables.

The initial definitions fetch occurs during client construction. Subsequent
native polling uses `TOGGLY_REFRESH_INTERVAL` (1–3600 seconds, default 10). The
native Rails `CacheSnapshotProvider` stores definitions in FileStore under an
app/environment-specific hashed namespace. `TOGGLY_CACHE_PATH` can change the
FileStore directory. This is definition caching, not per-user decision caching.
Missing-key mode deliberately ignores snapshots and uses all-OFF defaults.

After a restart during an outage, native `Toggly.client.ready` can remain false
while restored definitions still evaluate correctly. The UI presents readiness
and evaluations separately. `refresh(force: true)` rescues transport failures
inside the SDK; the refresh button says an attempt occurred, not that a fetch
succeeded. Native core usage/metric methods exist, but this adapter's configure
path leaves telemetry disabled and does not expose its transport options; this
sample makes no telemetry delivery claim. The optional WebSocket dependency is
not installed. There is no native variant allocation or public browser
subscription API in this sample's packages.

## Dedicated Toggly application

Use the [reviewed shared setup guide](../docs/APP_SETUP.md)
for actual picker labels, conditional origin settings, hidden filter management
fallback and final Save/request/readback. Create:

- Workspace: use one you can manage (the one from signup is enough); name **Ruby Rails SDK Sample**.
- Technology **Ruby on Rails** (`ruby-on-rails`); environment **Production**.
- Application URL **http://localhost:3007**. This server-only sample does not
  require enabling browser access just to reveal origin controls.
- Context kind **Order**: `Id` string key, `Vip` boolean, optional `Total` number.
- Baselines `new-dashboard`, `api-v2`, `enhanced-submit`, `beta-access` and
  `ExpressCheckout` with the sole `Order.Vip = true` ContextProperty rule.
- **Filters** category with all eleven exact keys/rules from
  [FLAG_TEMPLATE.md](../docs/FLAG_TEMPLATE.md). Keep indexed `alice` Targeting,
  Macintosh DeviceType and the other shared inputs unchanged.

Complete the normal final save/approval flow and verify the saved app and flags.
No live application is provisioned by the fixture, tests or CI.

## Exact matrix and known native outcomes

Matching is `alice`, `role=admin`, US, English, exact Chrome/macOS User-Agent and
`ord-vip`. Non-matching is `bob`, `role=user`, CA, French, exact Firefox/Windows
User-Agent and `ord-standard`. Both exact User-Agent strings are kept in
[request_context.rb](app/services/request_context.rb).

| Filter | Matching / Non-matching with the shared fixture |
|---|---|
| AlwaysOn | ON / ON |
| Percentage 50 | Sticky by identity; the observed alice/bob results are ON / ON |
| Targeting users=alice | ON / ON; native negative targeting is not demonstrated |
| UserClaims role=admin | ON / OFF |
| TimeWindow 2020–2099 | ON / ON while the window is open |
| Country US | ON / OFF |
| BrowserFamily Chrome | ON / OFF |
| BrowserLanguage en | ON / OFF |
| DeviceType Macintosh | OFF / OFF; native parser reports Other for the matching preset |
| OperatingSystem Mac | ON / OFF |
| ContextProperty Order.Vip | ON / OFF |

These native gaps stay visible; no replacement evaluator or extra AlwaysOff rule
forces the expected opposing result. The percentages and targeting parameters
in the fixture are the native published representations of the shared recipe.

## Manual checklist

- [ ] Missing-key banner is visible on all eight pages; sixteen defaults are OFF.
- [ ] Local fixture shows its own banner; Home and native captured blocks respond to `dashboard off/on` after polling.
- [ ] Any/All use both baseline flags; unknown and negated unknown outcomes are visible; no invented variant appears.
- [ ] Matching/Non-matching and custom fields update only this browser's session.
- [ ] Same identity with VIP and standard Orders yields the native Express Checkout outcomes.
- [ ] Matrix has eleven rows and visible Targeting/DeviceType limitations.
- [ ] Native gate denies with404; missing CSRF and invalid input yield422; permitted action persists its title.
- [ ] Native ready and restored values remain distinct; refresh reports an attempt accurately.
- [ ] Production CSS/JS load by digested URLs; desktop/mobile controls and navigation remain usable.
- [ ] Ctrl-C stops the fixture and app. With a live app, complete and verify the manual app/flag save flow separately.
