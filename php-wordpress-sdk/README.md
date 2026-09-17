# PHP WordPress SDK sample

A small WordPress site for learning feature flags with the published
`toggly/wordpress` package. Start without an account or app key: WordPress requests
receive explicit signed demo fixtures, and the installed SDK evaluates them.
The site uses ordinary Apache HTTP requests and PHP-FPM workers, with a separate
WordPress installation and SQLite database inside the ignored `.runtime/` folder.

## Run locally

You need PHP 8.5.x with OpenSSL and PDO SQLite, PHP-FPM 8.5, Composer 2, Python 3,
Apache 2.4 with `proxy_fcgi`, `curl`, `tar`, and `unzip`. On macOS, Homebrew PHP
provides `php` and `php-fpm`; the launcher uses the system Apache modules. On
Ubuntu, install Apache and use the same PHP 8.5.x as Composer, or let CI's
`setup-php` provide `php-fpm`.
Ensure the executables are on `PATH`. Do not run the launcher as root.

From this folder:

```sh
composer install
composer setup
composer test
composer build
python3 bin/serve.py
```

Open **http://localhost:8011**. Stop with **Ctrl+C**; the launcher closes only its
own Apache and FPM processes and removes its private socket (a short path under
`/tmp` so Unix socket limits are not exceeded). It does not change your system
Apache configuration or an existing WordPress site. Leave port 8011 free before
starting. Setup downloads the official archives listed in
[`config/releases.json`](config/releases.json), verifies their checksums, and
installs the official SQLite drop-in without modifications. Installation mail is
suppressed before WordPress runs its installer.

Setup is for a new installation. It refuses to overwrite an existing sample
database. Use `composer build` after editing CSS, and reload after editing PHP.
For a fresh local installation, stop the host and move the entire `.runtime/`
folder aside before running setup again. That folder contains the disposable
site, database, logs, and private credentials; never publish it.

Refreshed from public Composer and WordPress.org metadata on September 16, 2026:

| Installed component | Version |
| --- | --- |
| WordPress | 7.1 |
| SQLite Database Integration | 3.0.2 |
| `toggly/wordpress` | 1.0.0, locked from Packagist |
| `toggly/feature-management-php` | 1.0.0, locked from Packagist |
| PHP | 8.5.10 |
| Composer | 2.10.3 |

The Composer lockfile installs registry packages. No SDK source checkout, local
package path, or vendor patch is required. Check
[the WordPress adapter](https://packagist.org/packages/toggly/wordpress) and
[the core package](https://packagist.org/packages/toggly/feature-management-php).

## Your first flag

1. Open Home and find `new-dashboard` in the sixteen-key snapshot.
2. Choose **both** in **Offline flags**, then **Apply & refresh**. Open **Template
   gates**: the new dashboard is visible and the fallback is hidden.
3. Choose **neither** and apply. The dashboard is hidden, the fallback is visible,
   and both the All and Any combinations are OFF.
4. Try **dashboard** and **api** to explore the other two combinations. The
   `/sample-api` endpoint returns HTTP 200 only when `api-v2` evaluates true;
   otherwise it returns HTTP 403.
5. Use the **Matching** and **Non-matching** preset buttons. The native targeting
   shortcode admits Alice and hides its content for Bob. The separate core
   variant demo receives `compact` for Alice and `classic` for Bob when the
   dashboard is enabled.

Controls store allowlisted demo values in your browser's HttpOnly, SameSite=Lax
cookies. WordPress nonces bind the form to that browser session. A POST redirects
to a new request, which creates context and refreshes native definitions before
evaluating. Opening another browser session gives it independent choices. These
personas and claims do not authenticate users or grant WordPress permissions.

## Explore the eight sections

| Section | What it teaches |
| --- | --- |
| Start here (Home) | Missing-key mode, first flag, all sixteen native results, source pointers |
| Template gates | Namespaced native helper and native shortcode; PHP negation and All/Any composition |
| Programmatic API | Native plugin `isEnabled`, HTTP 200/403 gate, missing keys and loading failures |
| Identity | Explicit identity, claims and request input; browser isolation |
| Order context | VIP, standard and missing entities with the same user; native evaluator limitation |
| Filter matrix | All eleven exact shared rules and both presets |
| WordPress | Native plugin entry, Settings, administrator bar, scheduled hooks and telemetry limits |
| Core variants | Separate public PHP core provider, initial identity, signed assignment and configuration |

The native helper is namespaced:

```php
use function Toggly\WordPress\toggly_is_enabled;

if (toggly_is_enabled('new-dashboard', $requestContext)) {
    // Render the new view after your normal permission checks.
}
```

The native plugin instance supports the same explicit evaluation input:

```php
$plugin = \Toggly\WordPress\TogglyPlugin::getInstance();
$enabled = $plugin->isEnabled('api-v2', $requestContext);
```

For a simple identity, the native WordPress shortcode is:

```text
[toggly_feature name="filter-targeting" context='{"identity":"alice"}']
    A block for Alice.
[/toggly_feature]
```

Keep JSON array brackets out of shortcode attributes: WordPress's shortcode
parser stops at `]`. Pass rich request and Order data to the native PHP helper.
The plugin has no negation, multi-key or variant shortcode. The sample labels
its PHP combinations separately from the plugin's own APIs.

## Context and filter recipe

The five baseline keys are `new-dashboard`, `api-v2`, `enhanced-submit`,
`ExpressCheckout`, and `beta-access`. The four ordinary toggles use AlwaysOn when
enabled and an empty filter list when disabled. `ExpressCheckout` and
`filter-context-property` have an **Order** binding and the exact ContextProperty
rule below. Preserve their capitalization.

The following are the PHP SDK's verified wire parameter forms. These are rule
parameters, not the full definitions response. Keep all eleven `filter-*` keys in
the **Filters** category.

| Flag | Native filter | Parameters | Matching / Non-matching |
| --- | --- | --- | --- |
| `filter-always-on` | `AlwaysOn` | `{}` | ON / ON |
| `filter-percentage` | `Percentage` | `Value: "50"` | Sticky by identity; no prescribed Alice/Bob result |
| `filter-targeting` | `Targeting` | `Audience.Users:0: alice` | ON / OFF |
| `filter-user-claims` | `UserClaims` | `Percentage: "100"`, `Claim: role`, `Value: admin` | ON / OFF |
| `filter-time-window` | `TimeWindow` | `Start: 2020-01-01T00:00:00Z`, `End: 2099-12-31T23:59:59Z` | ON / ON within that window |
| `filter-country` | `Country` | `Percentage: "100"`, `Country:0: US` | ON / OFF |
| `filter-browser-family` | `BrowserFamily` | `Percentage: "100"`, `BrowserFamily:0: Chrome` | ON / OFF |
| `filter-browser-language` | `BrowserLanguage` | `Percentage: "100"`, `BrowserLanguage:0: en` | ON / OFF |
| `filter-device-type` | `DeviceType` | `Percentage: "100"`, `DeviceType:0: Macintosh` | OFF / OFF: native desktop parsing limitation |
| `filter-os` | `OperatingSystem` | `Percentage: "100"`, `OperatingSystem:0: Mac` | ON / OFF |
| `filter-context-property` | `ContextProperty` | `ContextKind: Order`, `Property: Vip`, `Operator: eq`, `Value: "true"`, `ValueType: boolean` | OFF / OFF: evaluator absent in PHP 1.0.0 |

The indexed keys such as `Audience.Users:0` are literal parameter names. The
complete multiline arrays are in [`src/FlagCatalog.php`](src/FlagCatalog.php).
The Device Type value stays **Macintosh**, and Operating System stays **Mac**.
Neither is rewritten to make the output match another SDK.

| Input | Matching | Non-matching |
| --- | --- | --- |
| Identity / userId | `alice` | `bob` |
| Claims | `role=admin` | `role=user` |
| Country | `US` | `CA` |
| Accept-Language | `en-US,en;q=0.9` | `fr-FR,fr;q=0.9` |
| Order | `{Id: "ord-vip", Vip: true, Total: 120}` | `{Id: "ord-standard", Vip: false, Total: 80}` |

Matching User-Agent:

```text
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

Non-matching User-Agent:

```text
Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0
```

The preset buttons apply these complete combinations. Individual selectors let
you change the Order without changing Alice. **missing** omits the entity.
Both Order flags remain OFF for VIP, standard and missing input because the
published PHP evaluator does not implement ContextProperty. The fixture keeps
the shared condition and binding; no sample evaluator replaces that gap.

## Connect your own application

Follow the [shared application setup guide](../docs/APP_SETUP.md)
with the values below. Local tests do not provision an application or prove a
live dashboard-to-SDK run.

1. In workspace **Toggly Samples**, create **PHP WordPress SDK Sample**. Select
   **WordPress** (technology key `wordpress`), set **Application URL** to
   `http://localhost:8011`, and select/create **Production**. For a server-only
   application, Allowed Web Origins may be absent. Do not change technology to
   reveal it. If browser access is already enabled, add `http://localhost:8011`
   with **Origin URL → Add Origin**; add `http://127.0.0.1:8011` only if you use it.
2. In **Contexts → New Context**, create kind **Order**, properties `Id` string,
   `Vip` boolean and `Total` number. Set **Key property** to `Id` and save.
3. Create all sixteen keys above. Bind **Order** to `ExpressCheckout` and
   `filter-context-property`; leave the others user-only. For each Order flag,
   choose **Add condition on Order → Vip → eq → true**, removing the default
   AlwaysOn user row. Other filter flags keep only their intended rule.
4. In Production's Conditions editor, configure each available rule above with
   segment Percentage **100**. Keep the standalone Percentage filter at **50**.
   Select **Save conditions**, then outer **Save Changes** or **Request Changes**,
   then **Save** or **Request** in the confirmation dialog. Complete normal
   approvals. To turn off an ordinary baseline, turn off its switch inside the
   editor and choose **Turn feature off**.
5. WordPress's filter picker can omit Percentage, Targeting and TimeWindow. Use
   the shared guide's authorized single-feature GET/PUT procedure for those
   rules. Use the PHP parameter forms here, not another language's aliases.
   Targeting's picker lists stored audience lists; `alice` is a member identity,
   not a list ID. Do not substitute scalar `Audience.Users: alice`.
6. Copy the application SDK key into the ignored local configuration:

   ```sh
   cp .env.example .env
   ```

   Set `TOGGLY_APP_KEY` to your own key and keep `TOGGLY_ENVIRONMENT=Production`.
   Signed definitions default to `true`; configure the application's definition
   signing accordingly. Restart the host. Process environment variables take
   precedence over `.env`. The native Settings page remains visible, but this
   sample's environment-backed WordPress option filter is authoritative.
7. Toggle `new-dashboard` in your app, finish the save/approval flow, then reload
   Template gates. The new request performs a native refresh. Recheck the full
   matrix and Order cases using the documented native limitations.

For the hidden filters, an **existing authorized management client** reads and
replaces the dedicated feature's complete rule list using:

```http
GET /api/v2/applications/{applicationId}/environments/Production/features/{featureKey}
PUT /api/v2/applications/{applicationId}/environments/Production/features/{featureKey}
Content-Type: application/json
```

Use the dashboard application short ID, not its SDK key. Hosted management URLs
start with `https://app.toggly.io`. The SDK app key is not management
authorization. Keep management tokens and cookies out of this sample. For
`filter-targeting`, the PUT body using PHP's literal indexed form is:

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

For Percentage and TimeWindow, use the same array shape with their names and
parameters from the table. GET first, review the exact target and complete list,
PUT only that dedicated sample feature, complete approvals, then GET again to
compare applied rules. HTTP 200 can still describe a pending change. Reopening
and saving raw indexed parameters in an editor that cannot represent them can
discard values; maintain those rules through the authorized client.

## WordPress lifecycle and current limitations

The MU loader requires Composer before the published plugin entry. It registers
the public cron schedules before native initialization and explicitly requests
`toggly_refresh_features` before page evaluations. Context is fixed before that
first evaluation; the separate core variant provider receives its identity
before its first fetch and calls `shutdown()` at request completion.

Native WordPress Settings and the administrator bar can be inspected by logging
in at `/wp-login.php`. Read your disposable credentials in
`.runtime/admin-login.txt`; the installer does not print or email the password.
The bar requires the real WordPress `manage_options` capability. Changing demo
claims does not grant it.

The public snapshot option is explicitly **none**. The package's default
transient adapter cannot load against PSR Simple Cache 3's method return types.
There is consequently no snapshot persistence between requests. A cron refresh
only updates its own request's memory; pages still perform their first refresh.

Automatic traffic-driven cron is disabled. While the host runs, an ordinary
scheduler can request the actual endpoint:

```sh
curl -fsS http://localhost:8011/wp-cron.php
```

The native hooks recur every **300 seconds** (`toggly_refresh_features`) and
**60 seconds** (`toggly_send_stats`). WordPress can finish the HTTP response
before doing due work, so an empty HTTP 200 alone does not prove callback
completion. The native acceptance test observes both callbacks, rescheduling
and lock release after running `wp-cron.php` through FPM.

The published WordPress request adapter currently loses the outgoing telemetry
body between its writable stream and HTTP send. The test observes a native usage
POST with an empty body after real enabled/disabled checks. This demonstrates a
send attempt, not delivered analytics. Configured mode uses the unmodified native
transport. The advertised on/off action bridge is not a working state-change
subscription in this package; the sample does not manually trigger those actions.
Native WordPress telemetry context is also distinct from explicit targeting
context, so the demo does not claim persona-attributed analytics.

An OFF result can mean a configured OFF flag, a missing key, an unsupported
filter, or unavailable definitions. The plugin exposes no public readiness
getter that distinguishes all these cases. After malformed initial definitions,
each native check can wait 2.5 seconds before false; a sixteen-flag page takes
roughly 40 seconds. The offline **invalid-json** option demonstrates this. Switch
back to **both** to recover on the next request. Within a single native provider,
the signing tests also verify retention of previously loaded valid definitions
after malformed or signature-invalid updates.

The local host sets PHP `max_execution_time=120`, FPM
`request_terminate_timeout=140s` with finished-request tracking, and Apache
`Timeout`/`ProxyTimeout=150`. Native live network retries can exceed the host
budget; the host can terminate such a request instead of producing a page.
These limits are not a successful readiness signal or a live retry guarantee.

Offline mode intercepts WordPress HTTP before transport, returns deterministic
Toggly fixtures and rejects other outbound WordPress requests. Its CSP keeps
browser assets on this origin. Fixture signatures follow the platform's
SHA-256 prehash plus ECDSA/SHA-256 protocol with an ephemeral fixture key. Valid
and tampered definitions and variants exercise native verification; this is
not live platform authenticity evidence. Adding an app key removes the fixture
interceptor. The scenario selector then has no effect on your live rules.

This is a local teaching installation using a normal production PHP-FPM request
lifecycle. Before deploying your own application, choose your standard HTTPS,
database, credentials, scheduler and host limits, and account for the package
limitations above. The loopback launcher is not a deployment configuration.

## Source map and verification

| File | Start here when learning |
| --- | --- |
| [`mu-plugins/sample.php`](mu-plugins/sample.php) | Composer ordering, mail suppression and native plugin entry |
| [`src/Runtime.php`](src/Runtime.php) | Public WordPress hooks, first refresh, request routing, cookies and nonces |
| [`src/RequestContext.php`](src/RequestContext.php) | Exact presets, entity shape and allowlisted controls |
| [`src/FlagCatalog.php`](src/FlagCatalog.php) | Sixteen keys and eleven unchanged native filter recipes |
| [`src/OfflineTransport.php`](src/OfflineTransport.php) | Explicit offline data and signing fixture; no custom evaluator |
| [`src/VariantRuntime.php`](src/VariantRuntime.php) | Request-owned native core variant provider |
| [`templates/`](templates/) | The eight examples and common controls/layout |
| [`assets/style.css`](assets/style.css) | Responsive presentation without external assets |
| [`bin/install.php`](bin/install.php) | Official disposable WordPress/SQLite installation |
| [`bin/serve.py`](bin/serve.py) | Isolated native Apache/FPM processes and cleanup |
| [`tests/`](tests/) | Request validation, HTTP acceptance, signing and actual cron checks |

Stop any running sample host, then run:

```sh
composer validate --strict
composer check-platform-reqs
composer test
composer build
python3 tests/run_hosted.py
```

The final command starts and closes its own host. Keep the app key empty; it
forces offline signed fixtures even if an ignored local `.env` exists. It checks
all sections, gates, native shortcodes, presets, Order gaps, concurrent browser
identity/variant isolation, invalid and cross-session nonces, the native Settings
page/admin capability, slow malformed-load recovery, signed update rejection and
actual cron execution. The failure test intentionally takes about 80 seconds
across two fresh requests. Results are written to ignored `tests/.results/`.
Temporary native test hooks are installed only during that test and removed in
`finally`; they are absent from normal setup and page routes.

The dedicated CI workflow installs locked packages and the official disposable
site, runs PHP lint/build and unit tests, then runs this native HTTP suite on
Ubuntu. Local results do not establish hosted CI status or live application
configuration.

## Manual checklist

- [ ] Visit all eight navigation sections and the sixteen-key JSON snapshot.
- [ ] Run the first-flag exercise and all four dashboard/API combinations.
- [ ] Switch Matching Alice and Non-matching Bob; compare the native shortcode,
  filter matrix and compact/classic variant configuration.
- [ ] Keep Alice fixed while changing VIP, standard and missing Orders; verify
  both Order flags retain the documented native OFF result.
- [ ] Open an independent browser session and confirm that changing one session
  leaves the other session's identity, Order and variant unchanged.
- [ ] Inspect the native Settings page and administrator bar using the disposable
  WordPress login, and check the page at a narrow mobile viewport.
- [ ] If connecting your own app, verify the applied Production configuration
  and dashboard ON/OFF reload exercise separately from offline test results.
