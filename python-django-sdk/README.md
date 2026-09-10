# Python Django SDK Sample

A standalone Django workshop using the published `toggly` core and
`toggly-django` adapter. All decisions come from the actual SDK. Explore native
AppConfig startup, middleware, decorators, template tags, context processor,
request identity, Order context and the eleven-filter matrix.

This is a **local learning app**. Its persona buttons intentionally sign in the
fixed Alice/Bob demonstration users without passwords. Keep the localhost bind;
use your real authentication and authorization in an application built from it.

## Quick start

Use Python **3.14.7** on macOS or Linux. The production example uses Gunicorn;
on Windows use WSL for the same commands.

```bash
cd python-django-sdk
python3.14 -m venv .venv
source .venv/bin/activate
python -m pip install --require-hashes -r requirements.txt
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(64))"
# Paste the generated value into DJANGO_SECRET_KEY in .env (local only).
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8000 --noreload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). With `TOGGLY_APP_KEY` blank,
every page displays **Missing TOGGLY_APP_KEY — offline fixture mode**. A public
`MemorySnapshotProvider` supplies deterministic sample definitions. The real
SDK evaluates them; this does not prove a live dashboard integration.

Local SQLite holds genuine Django users and sessions. `seed_demo` creates Alice
(`alice`, staff/admin demo role) and Bob (`bob`, ordinary role) with unusable
passwords. Neither the database nor `.env` belongs in git. The framework secret
signs Django sessions; it is separate from the Toggly app key. A generated
in-memory secret is a development fallback only: without a stable local secret,
sessions do not survive restarts. Production settings require an explicit secret.

## First flag exercise

1. Open **Declarative gates**. The offline fixture has `new-dashboard` ON and
   `api-v2` OFF: the native block and Any gate are ON; All is OFF; negated All is ON.
2. Follow the dedicated app recipe below, set `TOGGLY_APP_KEY` in `.env`, and restart.
3. Enable `new-dashboard` in Production. Click **Refresh definitions now** on
   Home, then reload Home and Declarative gates. Compare the snapshot, native
   block, assignment tag and programmatic result.
4. Disable `new-dashboard`, refresh and reload. The classic-dashboard fallback
   should render. This requires the actual environment change to be applied.
5. Read [gates.html](showcase/templates/showcase/gates.html), then
   [views.py](showcase/views.py). The comments connect each API to its behavior.

## Sections

| Contract section | Route | What to try |
|---|---|---|
| Home | `/` | Section map, first flag exercise, all sixteen flags and current contextual snapshot |
| Declarative gates | `/gates/` | `iffeature`, assignment tag, template filter, Any / All / negate, explicit variant action |
| Programmatic API | `/programmatic/` | Native helper versus explicit context; guarded enhanced POST |
| Identity | `/identity/` | Sign in Alice/Bob, clear real session; native Targeting route |
| Entity context | `/orders/` | VIP / ordinary / missing Order; multiple entities through `with_entity` |
| Filters matrix | `/filters/` | Matching / Non-matching presets, all eleven explicit and native results |
| Package-specific integration | `/integrations/` | AppConfig, middleware ordering, native decorator and view-switch routes |
| Missing-key banner | Every rendered section | Visible offline explanation and setup path |

`GET /api/snapshot/` returns all sixteen per-request results. Native routes under
`/native/` demonstrate allowed responses, 403, redirect and `feature_flag_switch`.
`POST /submit/` uses the native enhanced-submit decorator before updating a
reversible session counter. CSRF remains enabled; GET cannot submit it.

## Read the source in this order

1. [config/settings.py](config/settings.py): actual `TOGGLY` settings dictionary,
   native AppConfig registration, session/authentication/middleware ordering.
2. [showcase/apps.py](showcase/apps.py): offline-only snapshot composition and
   host-owned shutdown. The live path keeps the native AppConfig client.
3. [showcase/context.py](showcase/context.py): user and Order before first native
   helper read; explicit claims and `HttpRequestMapper` for the matrix.
4. [showcase/views.py](showcase/views.py) and [templates](showcase/templates/showcase/):
   native gates, literal template syntax, programmatic API and variant lifecycle.
5. [catalog.py](showcase/catalog.py) and [offline.py](showcase/offline.py): exact
   recipe data and labelled fixture definitions, never an alternative evaluator.
6. [tests](tests/) and [scripts/smoke.py](scripts/smoke.py): native requests, actual
   loopback HTTP/ES256 fixtures, concurrency and production WSGI checks.

## Context, initialization and native boundaries

**One ordinary client per worker.** The native AppConfig synchronously initializes
local definitions at startup. That definition fetch is context-free: it does not
need a future request's identity and is not followed by an extra context API call.
The SDK uses memory snapshots/defaults; unknown keys default OFF. On network or
signature failure it retains last-good definitions, or defaults if none were
loaded. There is no durable snapshot cache in this native AppConfig configuration.

Live polling runs every 30 seconds by default (`TOGGLY_REFRESH_INTERVAL`). Each
worker refreshes its own definitions; reload a page for a new server evaluation.
The refresh button calls the actual SDK `refresh()` and displays its status.
Offline refresh performs no network request and preserves the fixture. Home
shows selected debug fields only, never the app key. A recorded SDK error can
remain visible after a later successful refresh. This sample does not install
optional WebSocket/telemetry extras or claim live push/telemetry delivery.

**Native Django context** extracts `str(request.user.pk)`, groups, several traits
and `request.toggly_entity`. The custom demo user has a string username primary
key to match the shared literal `alice` recipe. `DemoContextMiddleware` sets the
entity before the native helper caches its context. For another Order in the same
request, use `context.with_entity(...)` with `client.is_enabled(..., context=...)`.
Changing `request.toggly_entity` after the first helper read does not rebuild its
cached context. Requests never change shared SDK identity.

**Claims and HTTP segments require application composition.** The published
adapter does not populate structured `EvaluationContext.claims` or `.request`.
The matrix copies the native context, adds the demo user's stored role, and uses
`HttpRequestMapper` on the exact preset headers. The native helper column shows
its narrower result honestly. These simulated header inputs are not measurements
of the visiting browser's location or device. In your application map trusted
principal claims and validated ingress headers instead.

**Template syntax is literal.** Load `toggly_tags`. Use
`{% iffeature 'new-dashboard' %}…{% else %}…{% endiffeature %}` for a block,
`{% feature_enabled 'new-dashboard' as enabled %}` for assignment, and
`{% feature_gate 'new-dashboard' 'api-v2' requirement='any' negate=True as gate %}`
for a gate. The native context processor is demonstrated with the literal
`{{ toggly.is_enabled.ExpressCheckout }}` key. For hyphenated keys use the tags:
Django's dictionary lookup uses a literal key before Python attribute fallback,
so `new_dashboard` does not resolve `new-dashboard` on this processor surface.
Do not use `request.toggly.flags` or `toggly.flags` as contextual results: they
expose the process-default flag snapshot.

**Variants use a separate explicit action.** The shared local client returns no
variant assignment. On `POST /variant/` only, the live example creates one isolated
core client with known `identity`, `variant_groups` and `variant_claims` in its
initial configuration, enables remote variants, calls `init()` and
`get_variant('new-dashboard')`, then closes the client. It never registers this
client globally. This incurs a remote assignment fetch for that action; ordinary
pages do not incur it. There is no native Django variant tag or per-call context
argument on `get_variant`. The baseline recipe has no experiment configuration,
so an absent assignment is normal. The fixture mode reports absence explicitly.
Remote assignment checks and signed-definition verification are separate tests.

**Entity kind and device limitations.** The published Python ContextProperty
evaluator checks entity properties without validating entity kind. The sample
supplies `Order` explicitly; the diagnostic wrong-kind VIP entity also returns ON.
The Python device classifier returns `Other` for the shared Macintosh User-Agent,
so `filter-device-type` remains OFF for both presets. The shared rule stays
`Macintosh`; no replacement filter, fabricated result or SDK patch is used.

**Lifecycle.** The native adapter has startup but no shutdown hook. The sample
owns cleanup through `close_client()`, `manage.py`'s `finally`, process exit and
Gunicorn `worker_exit`. Gunicorn runs without preload so workers initialize their
own clients. Normal `check`, `migrate`, `seed_demo` and `collectstatic` commands
skip network initialization; `runserver` and `test` initialize the native path.

## Provision the dedicated Toggly application

Provisioning has **not** been performed or verified against a live account.
These are human-run steps for the shared [flag template](../docs/FLAG_TEMPLATE.md).

1. In [app.toggly.io](https://app.toggly.io), choose workspace **Toggly Samples**.
   Create **Python Django SDK Sample**, technology **Python**, environment
   **Production**. Set **Application URL** to `http://localhost:8000`; add that
   origin and `http://127.0.0.1:8000` under **Allowed Web Origins** only if the
   existing client-side section is present. Server-only definitions do not use
   browser CORS.
2. In **Contexts**, choose **New Context**, Kind `Order`. Add `Id` type string,
   `Vip` type boolean, `Total` type number; choose `Id` as **Key property**, Save.
   The UI has no optional-property checkbox: optional `Total` describes entity data.
3. Create baseline keys `new-dashboard`, `api-v2`, `enhanced-submit`,
   `ExpressCheckout`, `beta-access`. Bind **ExpressCheckout** to the `Order`
   Context. For initial comparison enable new-dashboard/enhanced-submit/beta-access
   and disable api-v2. Add an Order condition `Vip` / equality (`eq`) / Boolean
   `true` to ExpressCheckout; remove the default AlwaysOn row.
4. Create category **Filters** and all eleven keys in the table below. Bind
   `filter-context-property` to **Order**. Each filter flag gets exactly its one
   intended rule. Do not leave an extra AlwaysOn row beside another rule.
5. In the environment feature list, the flag switch opens the inline Conditions
   editor. Use the available **User filter** types or **Add condition on Order**.
   Set every segment Percentage explicitly to **100**. Save conditions, then
   **Save Changes** or **Request Changes** to open the confirmation dialog.
   Review it and choose **Save** or **Request** to submit; finish any approval
   process. See the [shared setup guide](https://github.com/ops-ai/Toggly.Samples/blob/07c4c663ba95b6bb7f1c17e9e04d0fc95323b779/docs/APP_SETUP.md)
   for the complete application and condition controls.
6. Python's source-defined picker omits **Percentage, Targeting and TimeWindow**.
   Use the ordinary single-feature management API fallback below for these rules
   (or consistently for all table rows). Do not change application technology or
   create custom filter metadata expecting it to appear in the predefined picker.
7. Copy only the dedicated app's SDK app key into local `TOGGLY_APP_KEY`, restart,
   apply the presets and compare actual results after the rules are applied.

### Exact one-feature management API fallback

Use an existing authorized management client against your actual dashboard
origin. Hosted URL:
`https://app.toggly.io/api/v2/applications/{applicationId}/environments/Production/features/{featureKey}`.
The application ID is the short ID from its URL/response. GET the current rule
list first, review the replacement, then PUT a JSON array of rules to the same
URL with `Content-Type: application/json`. It replaces the **complete rule list
for that one existing feature/environment**; it does not create the feature or
set its application-level Order binding.

Use the existing authorized session or management Bearer token. The SDK app key
is not management authorization. Do not put management cookies or tokens in the
sample, README, `.env`, or shell history. Restrict this to your dedicated sample
flags: updating a feature can stop its running experiment.

Each table row is one object inside the one-item PUT array:

| Feature key | `name` | `parameters` |
|---|---|---|
| `filter-always-on` | `AlwaysOn` | `{}` |
| `filter-percentage` | `Percentage` | `{"Value":50}` |
| `filter-targeting` | `Targeting` | `{"Audience.Users:0":"alice"}` |
| `filter-user-claims` | `UserClaims` | `{"Claim":"role","Value":"admin","Percentage":100}` |
| `filter-time-window` | `TimeWindow` | `{"Start":"2020-01-01T00:00:00Z","End":"2099-12-31T23:59:59Z"}` |
| `filter-country` | `Country` | `{"Country:0":"US","Percentage":100}` |
| `filter-browser-family` | `BrowserFamily` | `{"BrowserFamily:0":"Chrome","Percentage":100}` |
| `filter-browser-language` | `BrowserLanguage` | `{"BrowserLanguage:0":"en","Percentage":100}` |
| `filter-device-type` | `DeviceType` | `{"DeviceType:0":"Macintosh","Percentage":100}` |
| `filter-os` | `OperatingSystem` | `{"OperatingSystem:0":"Mac","Percentage":100}` |
| `filter-context-property` | `ContextProperty` | `{"ContextKind":"Order","Property":"Vip","Operator":"eq","Value":"true","ValueType":"boolean"}` |

Example complete body for the Python-native targeting rule:

```json
[{"name":"Targeting","parameters":{"Audience.Users:0":"alice"}}]
```

Use the same ContextProperty body for ExpressCheckout. The literal indexed
`Audience.Users:0` value is exercised by this sample's installed Python evaluator;
the dashboard's scalar `Audience.Users` refers to a stored application list ID,
not the literal user name. The OS picker ID is `OS`; the supported wire alias here
is `OperatingSystem` with the same-named indexed parameter.

HTTP 200 can accompany a pending approval and the old applied rule list. After
approval, GET the feature again, compare stored rules, refresh the sample and
check the native results. Do not reopen/save API-managed rules in an editor whose
catalog cannot represent them: that can discard parameters. Preserve/edit those
rules through the same API. This recipe is source-backed, not proof of a deployed
management-to-definitions round trip.

## Matrix presets

| Input | Matching | Non-matching |
|---|---|---|
| User / role | alice / admin | bob / user |
| Country | US | CA |
| Accept-Language | `en-US,en;q=0.9` | `fr-FR,fr;q=0.9` |
| User-Agent | Chrome 120 on macOS 10.15.7 | Firefox 121 on Windows 10 |
| Order | ord-vip / Vip=true | ord-standard / Vip=false |

Exact User-Agent strings live in [context.py](showcase/context.py) and match the
shared template. Matching enables targeting, claims, country, browser, language,
OS and VIP context in the **explicit** column; Non-matching disables those.
AlwaysOn and the open 2020–2099 TimeWindow stay ON. Percentage is sticky, with no
prescribed Alice/Bob answer. Macintosh stays OFF as documented above. Native
Django claims/country/browser/language/OS columns stay OFF without explicit mapping.

## Versions and verification

Registry checkpoint: **2026-09-10**. Latest stable
[Python](https://www.python.org/downloads/) 3.14.7 and published PyPI
[Django](https://pypi.org/project/Django/) 6.1.1,
[toggly](https://pypi.org/project/toggly/) 0.7.0 and
[toggly-django](https://pypi.org/project/toggly-django/) 0.3.0.
Gunicorn 26.2.0, WhiteNoise 6.12.0 and python-dotenv 1.2.3 support the host;
cryptography 50.0.1 signs test-only loopback fixtures. Exact direct and transitive
versions plus artifact hashes are in `requirements.txt`; `requirements.in`
records the direct pins. To update, change the appropriate pin and regenerate
with `uv pip compile requirements.in --python 3.14 --generate-hashes --output-file requirements.txt`.
Dependabot tracks the actual pip manifests.

```bash
python -m pip check
python scripts/verify_lock.py
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py collectstatic --noinput
python manage.py test
python -m compileall -q config showcase tests scripts
# With your local DJANGO_SECRET_KEY configured:
python manage.py check --deploy --settings=config.production --fail-level WARNING
python scripts/smoke.py
```

There is no JavaScript build. The production equivalent is Django deployment
checks, collected static assets, Python compilation and an actual Gunicorn WSGI
startup/smoke. The smoke creates a temporary database and generated secret,
starts two workers, exercises real cookies/CSRF/forms/denied routes/static CSS,
then stops the host. Tests run without real keys or an external service, using
public snapshots and generated ES256 loopback fixtures. They distinguish signed
definition verification from remote variant assignment parsing.

For a manual production-host walkthrough on local HTTP:

```bash
python manage.py collectstatic --noinput
DJANGO_LOCAL_HTTP=1 gunicorn --config gunicorn.conf.py config.wsgi:application
```

The `.env` secret must be set. `config.production` uses DEBUG=False; the explicit
local HTTP switch relaxes HTTPS-only cookies/redirects for localhost testing.
WhiteNoise serves collected CSS. Do not enable the local switch on a public origin.

## Manual checklist

- [ ] Blank key boots, shows banner, and lists all eight sections / sixteen flags.
- [ ] Native block, assignment, filter and multi-key gates agree with the fixture;
      context processor follows the selected ExpressCheckout Order.
- [ ] Connected new-dashboard changes appear after SDK refresh and page reload.
- [ ] Enhanced POST succeeds when enabled; disabled returns 403 with no mutation.
- [ ] Alice is allowed through native Targeting; Bob/anonymous receive 403.
- [ ] Clear session removes user/preset/Order selections; separate browsers remain independent.
- [ ] VIP Order is ON, ordinary/missing OFF; same-request `with_entity` results agree.
- [ ] Both matrix presets show all eleven rows and the stated native limitations.
- [ ] Native Any/All/negate, redirect and view-switch routes behave as explained.
- [ ] Variant action reports absence unless a real remote assignment exists.
- [ ] Gunicorn serves CSS, forms work with CSRF, and shutdown exits normally.
- [ ] `.env`, SQLite files, collected assets and the virtual environment stay ignored.
- [ ] Live provisioning, approvals and management-to-SDK results are verified separately.
