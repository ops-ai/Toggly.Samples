# Python Flask SDK Sample

A standalone Flask workshop using the published `toggly` core and
`toggly-flask` adapter. Learn native extension startup, Jinja helpers,
view decorators, Blueprint gates, request identity, Order context and all eleven
shared filters. Every decision comes from the installed SDK.

This is a **local learning app**. Its persona buttons deliberately sign in fixed
Alice/Bob users without passwords. Keep the localhost bind; replace these controls
with your application's authentication and authorization when adapting the code.

## Quick start

Use Python **3.14.7** on macOS or Linux (WSL on Windows for Gunicorn).

```bash
cd python-flask-sdk
python3.14 -m venv .venv
source .venv/bin/activate
python -m pip install --require-hashes -r requirements.txt
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(64))"
# Paste that generated value into FLASK_SECRET_KEY in your local .env.
flask --app wsgi:application run --host 127.0.0.1 --port 5001 --no-reload
```

Open [http://127.0.0.1:5001](http://127.0.0.1:5001). With `TOGGLY_APP_KEY` blank,
every rendered page displays **Missing TOGGLY_APP_KEY — offline fixture mode**.
A public `MemorySnapshotProvider` supplies the shared demonstration definitions;
the real SDK evaluates them. This does not prove live dashboard integration.

Flask signs its session cookie using `FLASK_SECRET_KEY`; that secret is separate
from your SDK app key. The local `.env` is ignored. There is no database to set up.
The development factory can generate an ephemeral in-memory secret, but sessions
then stop working after restart or across workers. `.env.example` selects
`SAMPLE_PRODUCTION=1`, which requires an explicit stable secret. Do not commit it.

## First flag exercise

1. Open **Declarative gates**. The fixture has new-dashboard ON and api-v2 OFF:
   native Jinja dashboard and Any are ON, All is OFF, negated All is ON.
2. Follow the dedicated app recipe below, set `TOGGLY_APP_KEY` locally and restart.
3. Enable new-dashboard in Production, apply the change, then use **Refresh
   definitions now** on Home. Reload Declarative gates and Programmatic API.
4. Disable the flag, refresh and reload. The classic-dashboard fallback appears.
   Each Gunicorn worker owns its own refresh; allow the polling interval when
   comparing across workers.
5. Read [gates.html](showcase/templates/gates.html), then [views.py](showcase/views.py).
   The comments explain what each API decides and why context is supplied there.

## Sections

| Contract section | Route | What to try |
|---|---|---|
| Home | `/` | Section map, first-flag exercise, sixteen-key checklist and contextual snapshot |
| Declarative gates | `/gates/` | Native Jinja exact-key/attribute/disabled helpers, Any/All/negate, variants |
| Programmatic API | `/programmatic/` | Request helper versus explicit context, guarded enhanced POST |
| Identity | `/identity/` | Flask-Login Alice/Bob/session clear and native Targeting route |
| Entity context | `/orders/` | VIP/standard/missing Order plus same-request `with_entity` |
| Filters matrix | `/filters/` | Matching/Non-matching, eleven explicit and native results |
| Package-specific surfaces | `/integrations/` | Factory, FeatureFlagBlueprint, native decorators, switch and lifecycle |
| Missing-key banner | Every rendered section | Visible offline explanation and setup guidance |

`GET /api/snapshot/` returns all sixteen request-context results. Native routes
under `/native/` exercise actual allowed/403/redirect/fallback/switch behavior.
`POST /submit/` checks enhanced-submit before changing a reversible session counter.
CSRF stays enabled. GET cannot submit. Feature flags do not grant permissions.

## Read the source in this order

1. [showcase/__init__.py](showcase/__init__.py): app factory, native `Toggly`,
   Flask-Login, CSRF, configuration and worker-owned cleanup.
2. [context.py](showcase/context.py): fixed principals, Order before first helper
   read, explicit claims and simulated `HttpRequestMapper` inputs.
3. [views.py](showcase/views.py) and [templates](showcase/templates/): actual
   decorators/Jinja/programmatic calls and visible API limitations.
4. [catalog.py](showcase/catalog.py) and [offline.py](showcase/offline.py): shared
   flag recipe and public snapshot composition, never a replacement evaluator.
5. [tests](tests/) and [scripts/smoke.py](scripts/smoke.py): real Flask requests,
   signed localhost HTTP fixtures, concurrency and packaged Gunicorn behavior.

## Initialization, context and native boundaries

**One ordinary client per worker.** The live factory configures `Toggly(app)`
through actual Flask configuration keys. The extension initializes local
definitions once. It does not need a future HTTP request's identity for that
fetch, so request context before local evaluation does not cause a second API
call. Persona and Order controls never mutate shared SDK identity or refresh it.

The offline factory uses a preconfigured public snapshot client and calls
`set_default_client(client)` once at startup before `Toggly(app, client=client)`.
This registration is needed because native decorators resolve the core default
client; the supplied-client constructor alone does not register it. Run one
application/client per worker, not several independent apps sharing this global
registration. The tests close each application's client before the next setup.

**Flask-Login placement matters.** When Flask-Login is installed, the adapter
accesses `current_user`. Configure `LoginManager` and a user loader before
requests, even for anonymous visitors. The sample does so in the factory. It
loads only the fixed demo principals from signed sessions; it does not trust a
query parameter as a principal or add real authentication.

Native extraction provides user id, roles/groups, some traits and
`g.toggly_entity`. The sample sets Order before `g.toggly.context` caches its first
read. To evaluate another Order in the same request, use
`context.with_entity(other)` with `get_toggly().is_enabled(..., context=...)`.
Changing `g.toggly_entity` after a helper check does not rebuild that cached context.

**Claims and HTTP filters need explicit mapping.** The native extractor does
not populate structured `EvaluationContext.claims` or `.request`. The matrix
copies the native context, adds the fixed user's role, and maps exact preset
headers through `HttpRequestMapper.merge_into`. The narrower native-helper column
is shown separately. These are simulated inputs, not measurements of the current
browser or location. In your app use verified principal claims and trusted
proxy headers. Do not accept arbitrary clients' country headers as trusted facts.

**Jinja uses native syntax.** `toggly.check('new-dashboard')` uses an exact key;
`toggly.is_enabled.new_dashboard` maps underscores to hyphens through Jinja's
attribute lookup. `toggly.is_disabled.api_v2` negates the decision. For Any/All/
negate, compute `g.toggly.evaluate_gate(...)` in the view and pass the boolean to
Jinja. Do not confuse `toggly.flags` with a contextual result: it is the shared
client's process-default flag snapshot. Home evaluates each key explicitly.

**Variants have two distinct surfaces.** The native `feature_variant` decorator
is exercised at `/native/variant/`. Its disabled fallback and enabled view work,
but its named-view selection reads `get_feature_state(...).metadata['variant']`.
The published core does not put a variant name in that metadata, so named dispatch
is unavailable there. The sample does not fabricate metadata or silently replace
the decorator.

`POST /variant/` demonstrates the core's actual remote `get_variant` API. Only
this explicit action creates an isolated client with known identity, groups and
claims in initial configuration, enables variants, initializes, reads the assigned
name/configuration and closes. It never registers that client globally. This
avoids an anonymous initialization followed by an identity update/refetch; normal
pages do not create extra clients. The baseline flags have no experiment configured,
so no assignment is normal. Offline mode reports absence. Remote assignment
parsing and signed-definition verification are separate checks.

**Filter limitations remain visible.** The current Python device classifier
reports `Other` for the shared Macintosh User-Agent; DeviceType stays OFF for both
presets without changing the shared rule. ContextProperty checks properties without
validating entity kind; the wrong-kind VIP diagnostic is ON. Supply the correct
Order explicitly and do not treat that filter as a kind-isolation boundary.

**Defaults, refresh and cleanup.** Unknown keys default OFF. Startup failure uses
configured OFF defaults; later networking/signature failures retain last-good
definitions. This sample does not persist a durable snapshot. Live polling is
30 seconds by default; reload a page for new server decisions. Home displays a
small safe debug subset and offers native `refresh()`; an SDK error record may
remain visible after recovery. Offline refresh does not make a network request.
Optional WebSocket/telemetry extras are not installed and no push/telemetry delivery
is claimed. The SDK may log its optional metrics dependency notice.

`close_client(app)` closes once at process/worker shutdown. It is not registered
as a per-request Flask teardown, because that would close the shared client while
other requests still need it. Gunicorn preload is disabled so workers create their
own clients and threads. The sample is a synchronous WSGI app.

## Provision the dedicated Toggly application

Provisioning has **not** been performed or verified against a live account.
These are human-run steps for the shared [flag template](../docs/FLAG_TEMPLATE.md).

1. In [app.toggly.io](https://app.toggly.io), choose workspace **Toggly Samples**.
   Create **Python Flask SDK Sample**, technology **Python**, environment
   **Production**. Set **Application URL** to `http://localhost:5001`; add that
   origin and `http://127.0.0.1:5001` under **Allowed Web Origins** only if the
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
Flask claims/country/browser/language/OS columns stay OFF without explicit mapping.

## Versions and verification

Latest stable runtime and published dependency checkpoint: **2026-09-10**.
[Python](https://www.python.org/downloads/) 3.14.7,
[Flask](https://pypi.org/project/Flask/) 3.1.3,
[toggly](https://pypi.org/project/toggly/) 0.7.0,
[toggly-flask](https://pypi.org/project/toggly-flask/) 0.3.0,
Flask-Login 0.6.3, Flask-WTF 1.3.0 and Gunicorn 26.2.0.
python-dotenv 1.2.3 loads local configuration; cryptography 50.0.1 supports signed
definitions and generated test signatures; build 1.6.1 / setuptools 84.0.0 package
the sample. SDK packages always come from PyPI, never a local SDK build.

`requirements.in` contains exact direct pins; `requirements.txt` locks every
transitive dependency and artifact hash. `pyproject.toml` describes the sample
wheel. When updating a runtime pin, update both manifests, then regenerate with
`uv pip compile requirements.in --python 3.14 --generate-hashes --output-file requirements.txt`.
Dependabot tracks the actual pip manifests.

```bash
python -m pip check
python scripts/verify_lock.py
flask --app wsgi:application check-config
python -m unittest discover -s tests -v
python -m compileall -q showcase tests scripts wsgi.py gunicorn.conf.py
python -m build --wheel
python scripts/smoke.py
```

There is no JavaScript build. The production equivalent is Python compilation,
configuration validation, a wheel containing the templates/CSS, and actual
Gunicorn WSGI startup. The smoke extracts that built wheel in a temporary directory,
starts two workers with a generated process-only secret and placeholder key,
exercises HTTP cookies/CSRF/forms/static/native gates, then stops the host.
Tests also cover real signed loopback definitions, tampering/error/last-good
recovery, background refresh/shutdown, initial variant context, and concurrent
Flask sessions. None requires a live app or external database.

For a manual production-host walkthrough, with your local `.env` configured:

```bash
gunicorn --config gunicorn.conf.py wsgi:application
```

Open localhost:5001. DEBUG is off; CSRF, HttpOnly and SameSite=Lax cookies remain
on. `SAMPLE_HTTPS=0` allows local HTTP cookies; use `1` behind HTTPS in an adapted
application. Keep the local persona controls off public origins. The development
server command also loads `.env` through `wsgi.py` and avoids the reloader so it
does not create duplicate SDK clients.

## Manual checklist

- [ ] Blank key starts with a visible banner and all sections/sixteen flag keys.
- [ ] Jinja exact-key/attribute/disabled results and Any/All/negate match the fixture.
- [ ] A real new-dashboard toggle appears after SDK refresh and page reload.
- [ ] Enhanced submit updates once when enabled; disabled returns 403 before mutation.
- [ ] Alice passes native Targeting; Bob/anonymous receive 403; sessions stay separate.
- [ ] Clear session removes the user/preset/Order; it does not change global SDK identity.
- [ ] VIP is ON, standard/missing OFF; same-request Order copies preserve identity.
- [ ] Both presets expose eleven rows and the documented DeviceType/native-context gaps.
- [ ] Blueprint gate, Any/All/negate, redirect, fallback and switch use native routes.
- [ ] Native variant named-dispatch gap is visible; remote action reports actual assignment or absence.
- [ ] Production Gunicorn serves CSS; forms require CSRF and shutdown exits normally.
- [ ] `.env`, virtual environments, caches and generated wheel files stay ignored.
- [ ] Dedicated app setup, approvals and actual management-to-SDK results are verified separately.
