# PHP Laravel SDK Sample

A native Laravel workshop for `toggly/laravel` and `toggly/feature-management-php`.
Start without a Toggly key: an explicitly labelled local PSR transport supplies
definitions while the **published SDK** performs parsing, evaluation, Blade
rendering, route gating, snapshots, usage and metrics.

## Quick start

Use PHP **8.5.x** with OpenSSL, mbstring, DOM/XML, ctype, filter, hash, session
and tokenizer, plus Composer 2. No database or Node build is needed.

```bash
cd php-laravel-sdk
composer install --prefer-dist
cp .env.example .env
php artisan key:generate
php artisan serve --host=127.0.0.1 --port=8010
```

Open [localhost:8010](http://localhost:8010). The generated `APP_KEY` encrypts
Laravel's session cookies; it is separate from `TOGGLY_APP_KEY`. Keep both in
your ignored local `.env`. Never commit a real environment file.

**First flag:** visit Declarative gates, then Request identity. Choose **All
baseline flags OFF**, apply, and return to gates. The native `new-dashboard`
directive now renders the classic fallback. Choose **All baseline flags ON**
to see the Any, All and component gates together. The separate variant fixture
remains assigned to the persona; the baseline control does not change it.

`artisan serve` is a development server. The supported deployment lifetime is
ordinary **PHP-FPM**, which boots and tears down Laravel per request. Point
your web server's document root at `public/` and its front-controller FastCGI
route at `public/index.php`. Do not serve the repository root or `.env`.

## Published versions

Refreshed from public Composer metadata on September 10, 2026:

| Component | Version |
|---|---|
| PHP runtime | 8.5.10 |
| Composer | 2.10.3 |
| `laravel/framework` | 13.31.0 |
| `toggly/feature-management-php` | 1.0.0 |
| `toggly/laravel` | 1.0.0 |
| `guzzlehttp/guzzle` / `guzzlehttp/psr7` | 8.2.0 / 3.1.0 |
| `phpunit/phpunit` | 13.3.3 |

The manifest sets compatible published version ranges; `composer.lock` pins
the exact direct and transitive dependencies. There are no source/path repositories, vendor patches, unpublished
archives or downgraded host constraints. Check [Laravel on Packagist](https://packagist.org/packages/laravel/framework),
[the core package](https://packagist.org/packages/toggly/feature-management-php),
and [the Laravel adapter](https://packagist.org/packages/toggly/laravel).

## Create the dedicated Toggly app

Provisioning is a manual step; this sample does not create or claim an existing
live application. Follow the reviewed [shared app setup guide](https://github.com/ops-ai/Toggly.Samples/blob/07c4c663ba95b6bb7f1c17e9e04d0fc95323b779/docs/APP_SETUP.md)
and [shared flag template](https://github.com/ops-ai/Toggly.Samples/blob/07c4c663ba95b6bb7f1c17e9e04d0fc95323b779/docs/FLAG_TEMPLATE.md).

1. In workspace **Toggly Samples**, choose **Applications → Add new application**.
   Set name **PHP Laravel SDK Sample**, Technology Stack **Laravel** (`laravel`),
   and Application URL **http://localhost:8010**. Check **Adding to** before saving.
2. Use environment **Production**. This is server-only: the Allowed Web Origins
   section may be absent. If an existing client-access section is already shown,
   add `http://localhost:8010` there. Do not enable browser access to reveal it.
3. Under **Contexts → New Context**, create `Order` with `Id` string (Key property),
   `Vip` boolean and `Total` number, then Save. The sample treats Total as optional;
   the editor has no optional-property checkbox.
4. Create the exact sixteen keys below. Put the eleven `filter-*` keys in
   category **Filters**. Bind `ExpressCheckout` and `filter-context-property` to
   **Order** in the feature's Context field before creating the Vip condition.
5. Open each Production flag's Conditions editor. Keep only the intended rule;
   remove a default AlwaysOn row from Order conditions. Select **Save conditions**,
   then the outer **Save Changes / Request Changes**, then **Save / Request** in
   the confirmation dialog. Complete normal approvals and verify the applied rules.
6. Copy the SDK app key into your ignored `.env` as `TOGGLY_APP_KEY`. Keep
   `TOGGLY_BASE_URL=https://definitions.toggly.io/` and
   `TOGGLY_USE_SIGNED_DEFINITIONS=true`. Run `php artisan config:clear`, restart
   the development server and reload. The banner must now say Live definitions.

The source-defined Laravel picker omits Percentage, Targeting and TimeWindow.
Use the guide's ordinary authenticated **single-feature GET/PUT management API**
when a picker cannot represent the exact rule. An SDK app key does not authorize
management calls. Keep normal team/environment permissions and approvals; a
200 response can still represent a pending change. GET again after approval
and compare the entire applied rule list.

The PUT body is that feature's complete filter array, not a definitions envelope.
For example, the exact native PHP targeting body for `filter-targeting` is:

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

Do not use `Audience.Users: "alice"`: the scalar form names a stored platform
list. Native raw parameters below are strings and indexed lists. Reopening and
saving them in an incompatible picker may discard values; maintain them through
the same authorized management client. No credentials belong in sample files.

| Flag | Native definition rule / parameters |
|---|---|
| `new-dashboard` | `AlwaysOn` when enabled; baseline dashboard gate |
| `api-v2` | `AlwaysOn` when enabled; programmatic and Any/All gates |
| `enhanced-submit` | `AlwaysOn` when enabled; native POST route gate |
| `beta-access` | `AlwaysOn` baseline; offline mixed fixture targets alice |
| `ExpressCheckout` | `ContextProperty`: `ContextKind=Order`, `Property=Vip`, `Operator=eq`, `Value=true`, `ValueType=boolean` |
| `filter-always-on` | `AlwaysOn`, no parameters |
| `filter-percentage` | `Percentage`: `Value=50` |
| `filter-targeting` | `Targeting`: `Audience.Users:0=alice` |
| `filter-user-claims` | `UserClaims`: `Claim=role`, `Value=admin`, `Percentage=100` |
| `filter-time-window` | `TimeWindow`: `Start=2020-01-01T00:00:00Z`, `End=2099-12-31T23:59:59Z` |
| `filter-country` | `Country`: `Country:0=US`, `Percentage=100` |
| `filter-browser-family` | `BrowserFamily`: `BrowserFamily:0=Chrome`, `Percentage=100` |
| `filter-browser-language` | `BrowserLanguage`: `BrowserLanguage:0=en`, `Percentage=100` |
| `filter-device-type` | `DeviceType`: `DeviceType:0=Macintosh`, `Percentage=100` |
| `filter-os` | `OperatingSystem`: `OperatingSystem:0=Mac`, `Percentage=100` |
| `filter-context-property` | The same `ContextProperty` rule and Order binding as ExpressCheckout |

The platform disables a baseline by storing an empty rule list. The local OFF
fixture uses native AlwaysOff for an explicit teaching example; both evaluate OFF.
The executable native schemas are in [FlagCatalog.php](app/Support/FlagCatalog.php).

## Sections and source map

| Section | Route | Start reading |
|---|---|---|
| Home, first flag, map, sixteen-key checklist and snapshot | `/` | [home.blade.php](resources/views/home.blade.php) |
| Feature/fallback, negate, Any/All, component and variant comparison | `/gates` | [gates.blade.php](resources/views/gates.blade.php) |
| Injected manager, facade, missing-key default, gated POST | `/api`, `/api/snapshot` | [TogglyRuntime.php](app/Support/TogglyRuntime.php) |
| Session controls and explicit request context | `/identity` | [DemoContext.php](app/Support/DemoContext.php), [PrepareDemoContext.php](app/Http/Middleware/PrepareDemoContext.php) |
| VIP / standard / missing Order | `/orders` | [orders.blade.php](resources/views/orders.blade.php) |
| Eleven filters with Matching and Non-matching presets | `/filters` | [FlagCatalog.php](app/Support/FlagCatalog.php), [filters.blade.php](resources/views/filters.blade.php) |
| Native routes, attributes, cache, events, usage and metrics | `/integrations` | [web.php](routes/web.php), [NativeGateController.php](app/Http/Controllers/NativeGateController.php) |
| Missing-key / configuration-error banner | Every teaching page | [layout.blade.php](resources/views/layout.blade.php), [AppServiceProvider.php](app/Providers/AppServiceProvider.php) |

The adapter registers its native ServiceProvider through Composer discovery.
The application's provider binds PSR-18 HTTP and PSR-17 request factories.
`PrepareDemoContext` runs after Laravel's session and CSRF middleware, before
the native gates. The provider refreshes once before all ordinary evaluations.

## Identity, filters and honest limits

| Input | Matching | Non-matching |
|---|---|---|
| `identity` and `userId` | alice | bob |
| groups | beta-testers | empty |
| claims | role=admin | role=user |
| country | US | CA |
| Accept-Language | en-US,en;q=0.9 | fr-FR,fr;q=0.9 |
| User-Agent | Exact shared Chrome 120 / macOS 10.15.7 | Exact shared Firefox 121 / Windows 10 |
| Default Order | ord-vip, Vip=true | ord-standard, Vip=false |

The controls choose persona and Order independently. To apply the full shared
Non-matching preset, select both Non-matching and the standard Order.

`FeatureManager::isEnabled($key, $context)` and the facade accept the complete
explicit context. Native Blade, components and route/attribute gates build only
userId/user_id, groups and IP; they do not automatically forward these demo
claims or request-filter fields. The filter matrix therefore uses the explicit
core call. Neither request handlers nor the sample mutate shared SDK identity.

AlwaysOn and TimeWindow are ON for both presets. The percentage result is
sticky, not prescribed by the word Matching. Targeting, claims, country, browser,
language and operating system match alice's preset and reject bob's.

**Two shared-preset limits remain visible:** the PHP parser classifies the exact
Macintosh desktop device as `Other`, so DeviceType stays OFF for both presets.
The separate OperatingSystem `Mac` rule works. Published PHP has no entity API
or ContextProperty evaluator: ExpressCheckout and its matrix row remain OFF for
VIP, standard and missing orders. Order stays separate from user context; the
sample contains no custom filter that fabricates support.

Variants use a **separate, request-owned provider**, with immutable settings
identity before its first refresh. The endpoint receives `userId` only: no
groups, claims or entity context are claimed. Native `getVariant()` returns
`name` and `configurationValue`; ordinary Blade compares the name. Missing or
unrecognized assignments use the default layout. Offline fixtures prove
assignment parsing only, separately from signed-definition authenticity.
Live variants are opt-in with `TOGGLY_ENABLE_VARIANTS=true`; configure compact
and classic named assignments on `new-dashboard` in your application first.

## Request lifecycle and failures

The native context provider captures a Request in a singleton. This application
supports ordinary PHP-FPM request teardown, **not Octane or a persistent Laravel
application container**. PHP-FPM may reuse a worker process, but reconstructs the
PHP application for every request. Each browser has a separate encrypted session
cookie and server-side session file. The controls are demo personas, not real
authentication; real authorization must remain independent of feature flags.

Snapshots use the native Laravel cache adapter with the `array` store, so neither
the snapshot nor identity assignments cross requests. Live updates are disabled;
reload for a fresh fetch. No scheduler or background polling is implied.
The sample registers and unregisters the exact native definitions callback,
shuts down both providers and flushes usage/metrics in `finally`, including
denied routes. Offline transport also absorbs destructor telemetry.

A blank key selects local fixtures immediately. A configured key selects real
HTTP; it never silently falls back to demo data. Failed initial loads show
UNKNOWN instead of successful OFF results. Malformed signed envelopes are
caught at the sample display boundary; native verification stays unchanged.
Native HTTP retries can wait **254 seconds of backoff** across eight attempts,
plus network time, for an unreachable or invalid configured endpoint/key.
This SDK behavior also applies to failed telemetry flushes. A short Guzzle
timeout limits each attempt, not the complete native retry sequence.

The JSON endpoint whitelists safe fields and never returns native debug data
or raw errors, which can contain the app key in a URL. SDK logging uses a null
channel for the same reason. Do not use this sample as an observability blueprint.
Use HTTPS and `SESSION_SECURE_COOKIE=true` when serving beyond localhost.

## Verification and production optimization

```bash
composer validate --strict
composer check-platform-reqs
php artisan optimize:clear
composer test
composer build
```

`composer build` caches configuration, routes and compiled Blade views. Run it
with the intended deployment environment, then serve with PHP-FPM. Run
`php artisan optimize:clear` before changing environment values or running tests:
cached production configuration otherwise takes precedence over PHPUnit's env.
For a deployment install, use `composer install --no-dev --prefer-dist
--optimize-autoloader` in a separate checkout. Keep storage and bootstrap/cache
writable by the PHP-FPM application user.

The tests execute actual Laravel requests, native Blade and middleware, exact
filter results, session validation and CSRF rejection, variants with initial
identity, signed native refresh/cache restore, tamper and unsigned-definition
rejection, event unsubscribe, usage and metric cleanup, and safe error output.
Signing keys are generated in memory for each test. Signed definitions follow
the platform's SHA-256-prehash + ECDSA/SHA-256 protocol; the variant fixture is
separate parsing evidence. CI uses placeholder configuration and no live keys.

## Manual checklist

- [ ] Blank key: all seven teaching pages render with the visible offline banner.
- [ ] Change baseline scenarios: dashboard fallback, negate, Any/All and component outputs change.
- [ ] Try gated POST and native beta/attribute routes; verify permitted, 404, 403 and redirect outcomes.
- [ ] Use separate normal/private windows for alice and bob; reload both and check session isolation.
- [ ] Apply each complete preset and inspect all eleven rows, preserving the two documented gaps.
- [ ] Try VIP, ordinary and missing Order while keeping the user's identity unchanged.
- [ ] Switch personas and observe compact/classic fixture assignments and their configuration value.
- [ ] Record a metric; local mode confirms recording without claiming dashboard delivery.
- [ ] Test keyboard navigation, labels, focus and narrow-screen table scrolling.
- [ ] With a manually provisioned app, configure a real local key, clear config cache,
      change new-dashboard in Production, and reload. Record live acceptance separately.

Independent review, hosted CI and live provisioning are separate evidence gates.
