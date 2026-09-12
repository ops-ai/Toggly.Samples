# Elixir / Phoenix SDK showcase

A working Phoenix 1.8 / LiveView 1.2 application using `toggly`, `toggly_phoenix` and `toggly_live_view` **0.1.0**. It teaches feature flags through local OTP evaluation, server route gates and independent LiveView contexts.

## Quick start

Install Elixir **1.20+** and Erlang/OTP **29+** (verified with 1.20.4 / OTP 29). From this folder:

```sh
cp .env.example .env
mix setup
mix phx.server
```

Open [http://localhost:4000](http://localhost:4000). With no app key the yellow banner explains that **local demonstration definitions** are active. The fixture file is deliberately unsigned and selected only in offline mode. This does not establish a connection to your dashboard. All controls still work, including Matching/Non-matching identity presets.

Mix does not automatically load `.env`. To use its values with your shell:

```sh
set -a
source .env
set +a
mix phx.server
```

`mix setup` downloads Hex dependencies and copies the resolved Phoenix/LiveView browser clients into generated assets. No npm build is required. Generated assets and `.env` are ignored by Git; there is no committed local SDK dependency or vendored SDK source.

## Connect your Toggly application

1. Follow [application setup](../docs/APP_SETUP.md). Create **Elixir Phoenix SDK Sample**, environment **Production**, application URL `http://localhost:4000`. The source-defined technology catalog has no Elixir/Phoenix entry; use **Other** (`other`). This is server-side evaluation; it does not require browser Allowed Web Origins.
2. In application settings choose **Generate Key**, then Type **Backend**, optionally restricted to **Production**. Put that SDK key in `TOGGLY_APP_KEY`. Keep it on the server. It is not a management API credential.
3. Follow the [shared flag template](../docs/FLAG_TEMPLATE.md) for all sixteen keys. Create context kind **Order** with `Id` (key/string), `Vip` (boolean), and optional `Total` (number). Bind **ExpressCheckout** and **filter-context-property** to Order before adding the `Vip eq true` condition.
4. Use short native filter names and the parameters below. Other technology may not expose Percentage/Targeting/TimeWindow in its picker. Use the source-verified [single-feature management procedure](../docs/APP_SETUP.md#when-a-filter-is-missing-from-the-picker) for those conditions through your existing authorized client. Do not create new credentials or paste management tokens into this sample.
5. Save the editor changes, then **Save Changes** (or Request Changes) and complete the confirmation/approval. Restart the sample after setting environment variables. The missing-key banner disappears; signed remote definitions replace defaults only after verification.

| Variable | Meaning |
| --- | --- |
| `TOGGLY_APP_KEY` | Server-only backend SDK key. Empty selects local fixtures. Never exposed to browser JavaScript. |
| `TOGGLY_ENVIRONMENT` | Exact environment name, defaults to Production. Read at process startup; restart after changes. |
| `TOGGLY_MAX_SIGNATURE_AGE_SECONDS` | Optional whole-second signed-envelope age limit. Empty, 0 or negative disables it; invalid text fails startup. Read at runtime startup; restart after changes. |
| `PORT` | Loopback HTTP port, defaults to 4000. Update application URL if changed. |
| `SECRET_KEY_BASE` | Phoenix session/LiveView signing secret. Required for production; development/test generate an ephemeral value, so old sessions expire on restart. |

These are runtime server variables. There are no browser-prefixed variables or build-time key substitutions.

## Your first toggle

In connected mode, enable `new-dashboard` with **Always On** and save. Within the WebSocket update or the next 60-second poll, the snapshot row shows ON and the declarative card says **New dashboard enabled**. Disable it (empty condition list), save, and expect **Classic dashboard fallback** and the negated-gate text. The all-key example requires both `new-dashboard` and `api-v2`; the any-key example needs one.

A **key** is the exact name used in code. A **definition** contains that key's conditions for an **environment**. **Evaluation** combines those conditions with the current context into a boolean. These branches are not multivariate experiment assignments; this package family does not expose a variant-assignment API.

With the key still empty, changing the dashboard cannot affect the sample. To practice offline, change the `new-dashboard` fixture's filters from `[{"name":"AlwaysOn","parameters":{}}]` to `[]` in `priv/offline-definitions.json`, restart, and observe the same enabled/disabled expectations. Restore the fixture afterward.

## Sections

| Contract section | Where | What to try |
| --- | --- | --- |
| Home | `#home` | Navigation, all sixteen keys, evaluated snapshot |
| Declarative gates | `#declarative` | Feature/fallback, negate, all and any; variant limitation explained |
| Programmatic API | `#api` | Server-side enhanced-submit handler; records usage when work runs |
| Identity | `#identity` | Open two tabs, select Alice and Bob independently |
| Entity context | `#entity` | VIP order versus standard order for ExpressCheckout |
| Filter matrix | `#filters` | Compare Matching and Non-matching presets |
| Package surfaces | `#phoenix` | Plug route, explicit refresh, OTP/LiveView lifecycle |
| Missing key banner | Top of page | Explicit offline-fixture mode without a crash |

## Verified filter parameters

[`priv/offline-definitions.json`](priv/offline-definitions.json) is an executable reference for the exact backend wire shape, including all sixteen feature keys. Each filter row has its one intended condition; remove an unrelated AlwaysOn row from restrictive flags.

| Filter | `parameters` |
| --- | --- |
| AlwaysOn | `{}` |
| Percentage | `{"Value":50}` |
| Targeting | `{"Audience.Users:0":"alice","Audience.DefaultRolloutPercentage":0}` |
| UserClaims | `{"Claim":"role","Value":"admin","Percentage":100}` |
| TimeWindow | `{"Start":"2020-01-01T00:00:00Z","End":"2099-12-31T23:59:59Z"}` |
| Country | `{"Country:0":"US","Percentage":100}` |
| BrowserFamily | `{"BrowserFamily:0":"Chrome","Percentage":100}` |
| BrowserLanguage | `{"BrowserLanguage:0":"en","Percentage":100}` |
| DeviceType | `{"DeviceType:0":"Macintosh","Percentage":100}` |
| OperatingSystem / OS | `{"OperatingSystem:0":"Mac","Percentage":100}` |
| ContextProperty | `{"Property":"Vip","Operator":"eq","Value":"true","ValueType":"boolean"}` with definition `contextKind: "Order"` |

Matching uses Alice, admin claims, US, English, Chrome on macOS, and `ord-vip` with `Vip=true`. Non-matching uses Bob, user claims, CA, French, Firefox on Windows and `ord-standard` with `Vip=false`. Exact shared User-Agent strings live in `Showcase.Context`.

Expect targeting, claims, country, browser, language, device, OS and context rows ON for Matching and OFF for Non-matching. AlwaysOn stays on; TimeWindow stays on while open. Percentage is sticky per identity and its result is not prescribed by the preset name. The native filters use local evaluation, including mandatory entity gates.

## Initialization, failure behavior and identity scope

`Showcase.Application` supervises one fixed `Showcase.Flags` client. Its GenServer owns definitions, timers and protected ETS state; each evaluation reads the local snapshot. Connected mode starts with explicit false defaults for the four baseline keys. An unavailable first fetch leaves defaults in place; later errors preserve last-known-good definitions. Unknown keys default false. Refresh failure does not force existing active flags off.

Online definitions use ES256 signatures by default. This sample does not configure a persistent online snapshot file. The SDK supports an optional file snapshot and configured trusted JWKS for signed offline restarts; see [Elixir SDK docs](https://docs.toggly.io/sdks/elixir). WebSockets invalidate definitions; polling provides a fallback. Stop/restart is owned by the application supervisor.

Set `TOGGLY_MAX_SIGNATURE_AGE_SECONDS=86400`, for example, to reject newly received signed envelopes older than one day (the exact boundary is allowed). Rejected refreshes preserve active verified flags and their ETag; this is not a timer that turns active flags off. A cold start with no fresh response retains defaults. If you later configure a trusted signed snapshot, an older-than-limit file is also rejected on offline startup, so choose the limit with your expected outage duration in mind. Future-skew and rollback checks still apply even when age checking is disabled. This sample's explicit unsigned offline fixture mode is unaffected. CI sets 60 seconds to test runtime parsing/forwarding while using no app key.

Each socket's `toggly_context` map contains identity, groups, claims, request attributes and its Order entity. A preset click changes only that socket. `Order.key` identifies the record; `attributes.Vip` is the condition input. An Order condition must pass in addition to any user condition. HTTP Plug assigns do not automatically become a LiveView session: real applications populate trusted socket/session context from authentication before the Toggly mount hook.

The demo's selectable claims are not authentication. Gates do not replace authorization, and the server action reevaluates the flag even when its button is visible. Boolean evaluation records check counts; explicit successful work records usage. Usage packets contain no raw identity/claims. Custom metrics use native Telemetry/exporter events; automatic Toggly gRPC metric upload and Ecto/cache-specific adapters are not exposed here.

## Source-reading map

| File | Start here to learn |
| --- | --- |
| `mix.exs` | Hex package versions and setup/build aliases |
| `config/runtime.exs` | Runtime variables and missing-key mode |
| `lib/showcase/application.ex` | One shared supervised client, explicit defaults and offline fixture boundary |
| `lib/showcase/router.ex` | Server-side beta-access Plug gate |
| `lib/showcase/context.ex` | Exact shared identity/request/entity presets |
| `lib/showcase/live.ex` | Mount/update assignments, HEEx gates and reevaluation at the submit boundary |
| `assets/app.js` | Browser LiveSocket startup; no SDK app key |
| `test/showcase_test.exs` | Full host checks and simultaneous context isolation |

## Verification checklist

```sh
mix format --check-formatted
mix compile --warnings-as-errors
mix assets.build
mix test
mix hex.audit
```

- Start without a key: see the missing-key banner, all eight sections and usable preset controls.
- Open two tabs: Alice and Bob remain independent; Order and filter outcomes match the table.
- Connected mode: switch new-dashboard off/on and verify both the snapshot and card update without a page reload.
- Toggle beta-access and request `/protected`: enabled returns 200; disabled returns 404.
- Toggle enhanced-submit: enabled work is accepted; disabled work is rejected on the server.
- Temporarily interrupt network access: existing verified definitions remain active; restore it and verify refresh recovery.
- Stop the host: the OTP tree, WebSocket and subscriptions shut down.

Offline tests and candidate artifact installation do not prove dashboard provisioning, key permissions or live connectivity. CI runs without a real key. SDK packages are consumed through Hex version references; package publication order is core, Phoenix, then LiveView.

## Offline restart with live definitions

Set `TOGGLY_SNAPSHOT_PATH` to a writable file in a durable application-owned directory when using `TOGGLY_APP_KEY`. After a successful signed refresh, the SDK stores the original signed envelope and accepted public signing keys. A fresh supervised client restores and verifies that file before network refresh. Use a separate file per application/environment; endpoint and scope changes reject the stored entry. `TOGGLY_MAX_SIGNATURE_AGE_SECONDS` and key expiry still limit offline restoration.

The file is trusted local application state. Protect its directory with OS permissions. Independently configure `jwks` or `allowed_kids` in your application's client options to constrain key substitution; replacing the entire unpinned file with another valid key/envelope cannot be detected using that same file. This is not an external rollback ledger.

Without `TOGGLY_APP_KEY`, the sample uses its explicit unsigned demonstration fixture. That mode demonstrates local evaluation and does not prove a live signed cache.
