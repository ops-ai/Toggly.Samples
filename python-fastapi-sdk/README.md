# Python FastAPI SDK Sample

A native FastAPI workshop using published `toggly` and `toggly-fastapi`. Follow
one flag through dependencies, templates, router gates, request identity, Order
context and eleven filters. The installed SDK makes every decision.

This is a **local learning app**. Alice/Bob buttons deliberately select fixed
personas without passwords. Keep the localhost bind; replace these controls with
your application's authentication and authorization when adapting it.

## Quick start

Use Python **3.14.7**:

```bash
cd python-fastapi-sdk
python3.14 -m venv .venv
source .venv/bin/activate
python -m pip install --require-hashes -r requirements.txt
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(64))"
# Paste that generated value into SAMPLE_SESSION_SECRET in your local .env.
uvicorn asgi:application --host 127.0.0.1 --port 8002
```

Open [http://127.0.0.1:8002](http://127.0.0.1:8002). No database or JavaScript build
is required. `asgi.py` loads the ignored local `.env`; existing environment values
win. The development command avoids a reloader and duplicate SDK startup.

A blank key (or CI placeholder) shows **Missing TOGGLY_APP_KEY — offline fixture
mode** on every workshop page. A public `MemorySnapshotProvider` supplies local
shared rules to the real evaluator. The fixture enables dashboard, beta and
submit, disables api-v2, and evaluates contextual rules. This is demonstration
data, not a downloaded configuration or proof of a live app. A configured app
that cannot load its initial definitions instead uses all-OFF defaults; native
action gates deny before changing state.

`SAMPLE_SESSION_SECRET` signs the session cookie; it is separate from the SDK app
key. `.env.example` enables `SAMPLE_PRODUCTION=1`, requiring an explicit stable
secret so sessions work after restart and across workers. Development factories
can generate an ephemeral in-memory secret. Never commit either secret.

## First flag exercise

1. Open **Declarative gates**. Offline new-dashboard is ON and api-v2 OFF:
   dashboard and Any show true, All false, negated All true.
2. Follow the dedicated app setup below, put its app key in `.env`, restart.
3. Enable new-dashboard in Production and apply the change. Use Home's
   **Refresh definitions now**, then reload Declarative gates and Programmatic API.
4. Disable the flag, refresh and reload. The classic-dashboard fallback appears.
   With multiple workers, allow their polling interval for consistent views.
5. Read [gates.html](showcase/templates/gates.html) beside
   [routes.py](showcase/routes.py): the SDK evaluates; the template chooses a view.

## Sections

| Contract section | Route | Try this |
|---|---|---|
| Home | `/` | Section map, sixteen-key checklist, contextual snapshot and refresh |
| Declarative gates | `/gates/` | Native helper, disabled/negate, Any/All, remote variant name/configuration |
| Programmatic API | `/programmatic/` | Boolean dependency, helper and explicit core context; guarded POST |
| Identity | `/identity/` | Signed-session Alice/Bob/clear, ContextDep and native Targeting route |
| Entity context | `/orders/` | VIP/standard/missing Order and same-request with_entity copies |
| Filters matrix | `/filters/` | Exact Matching/Non-matching presets; explicit versus native context |
| Package-specific surfaces | `/integrations/` | Middleware, dependencies, router, decorators, switch, OpenAPI, lifespan |
| Missing-key banner | Every workshop page | Visible offline explanation; no startup crash |

`GET /api/snapshot/` returns sixteen actual evaluations after an async boundary.
`POST /submit/` checks native `require_feature` before changing a reversible
session counter; GET cannot mutate it, and all POST controls require CSRF.
Feature flags are not an authorization system.

## Read the source in this order

1. [showcase/__init__.py](showcase/__init__.py): factory, current FastAPI lifespan,
   public `configure_toggly`, stable sessions and worker-owned shutdown.
2. [context.py](showcase/context.py): principal and Order placement before cached
   helper reads; explicit claims and simulated HTTP segment mapping.
3. [routes.py](showcase/routes.py) and [templates](showcase/templates/): native
   dependencies/decorators/router/switch, Jinja booleans, CSRF and remote variants.
4. [catalog.py](showcase/catalog.py) and [offline.py](showcase/offline.py): shared
   rules and public snapshot data, never a replacement filter evaluator.
5. [tests](tests/) and [scripts/smoke.py](scripts/smoke.py): real ASGI requests,
   signed loopback transport, concurrent sessions and a packaged production host.

## Initialization, async work and context

**One definition client per worker.** The lifespan creates a synchronous
`TogglyClient`, initializes it off the event loop, and calls
`configure_toggly(client=client)` once. The SDK adapter stores a global application
reference, so run one application/client per worker. Do not configure independent
apps concurrently in the same process. Tests use sequential lifespans.

Server-local definition downloads do not need a future request's identity.
Supplying that identity and entity before the first **local evaluation** does
not cause another API call. Persona and Order controls never mutate the shared
client, call `set_identity`, or reinitialize definitions.

**The adapter helpers are synchronous.** `TogglyDep`, `ContextDep`, `get_toggly`,
`feature_enabled`, native gates and the template helper use the registered sync
client. Do not put `AsyncTogglyClient` into `configure_toggly` for these helpers:
they call methods without awaiting them. Local helper checks are not awaitable.
Startup HTTP, explicit refresh and synchronous close use AnyIO's worker thread.
Live background polling is owned by the core client; it is not an ASGI task.

Middleware order is SessionMiddleware → DemoContextMiddleware → native
TogglyASGIMiddleware → FastAPI dependencies/endpoints. The sample sets
`request.state.user` and `request.state.toggly_entity` before any helper evaluates.
The pure ASGI middleware attaches `request.state.toggly`, sets its native
ContextVar and resets it in `finally`. Tests interleave 24 independent sessions
and cover exceptions and cancellation without leaking request context.

The helper caches its `EvaluationContext` on first read. Updating state afterward
does not rebuild it. To check another Order in the same request, use
`client.is_enabled('ExpressCheckout', context=context.with_entity(other_order))`.
The copied context preserves identity/groups/claims. The native
`with_feature_context` dependency constructs a narrower identity/groups/traits
context and drops entity; it is not used for Order examples.

**Claims and request segments need explicit mapping.** Native extraction gives
user id, roles/groups, traits and entity. It does not populate structured
`EvaluationContext.claims` or `.request`. The matrix copies that context, adds a
fixed persona role and calls `HttpRequestMapper.merge_into` with exact simulated
preset headers. The native-helper column intentionally remains narrower. In your
application use verified principal claims and trusted proxy context; the demo
country and browser inputs are not measurements of the visiting user.

**Jinja and route gates use actual native APIs.** FastAPI has no Toggly Jinja tag
extension. The template receives `TogglyRequestHelper` and uses ordinary if/else
around `is_enabled`, `is_disabled` and `evaluate_gate`. `helper.flags` contains
process-default decisions, so Home explicitly evaluates each key with the full
request context. Native `require_feature`, `require_features`,
`FeatureGateDependency`, `feature_flag_required`, `feature_gate_required` and
`FeatureFlagRouter` protect their actual routes. The router's handlers include a
typed `Request` so the native wrapper can extract context.

`feature_switch` returns a generic `*args/**kwargs` callable. Registering that
callable directly with FastAPI would expose incorrect query parameters. A typed
sample wrapper passes its Request to the **native switch**, which still chooses
between the actual enabled/disabled handlers. OpenAPI shows the ordinary route
shape, not current flag permissions.

**Remote variants are an explicit action.** The native FastAPI helper does not
provide a variant method. Only `POST /variant/` creates an isolated
`AsyncTogglyClient`, sets identity/groups/claims in its initial `TogglyConfig`,
awaits `init()` and `get_variant('new-dashboard')`, then closes in a shielded
finally block. It never replaces the worker client. This avoids an anonymous
initial assignment followed by a second identity update/fetch. Ordinary pages
create no extra client or assignment request.

A boolean flag need not have an experiment assignment; absence is normal.
Offline mode reports absence. A configured experiment can show its actual name
and configuration. Signed-definition verification and assignment parsing are
separate tests. Cancelling an async SDK request cleans up the sample-owned client;
the SDK's already-running executor HTTP operation can continue until it completes
or reaches its timeout. This sample does not claim socket-level cancellation.

**Defaults, refresh and ownership.** Missing keys default OFF. Initial loading
errors use configured OFF defaults; later network/signature errors retain the
last-good definitions. This sample does not configure a durable snapshot. The
live polling interval defaults to 30 seconds. Reload server-rendered pages after a
change; each Uvicorn worker refreshes independently. Offline `refresh()` reports
`defaults` without fetching and retains the already loaded fixture decisions.
A recorded SDK error can remain visible after recovery; Home does not expose keys
or raw diagnostic configuration.

The lifespan closes the shared client once at worker shutdown, never per request.
Uvicorn creates the application and lifespan separately in each worker. Optional
WebSocket/telemetry paths are disabled; no push or telemetry delivery is claimed.

**Visible filter limitations.** Python classifies the shared Macintosh User-Agent
as `Other`, so DeviceType remains OFF for both presets without changing the rule.
ContextProperty checks properties without validating kind; the wrong-kind VIP
diagnostic is ON. Supply the correct Order and do not treat that filter as a
kind-isolation boundary.

## Provision the dedicated Toggly application

Provisioning has **not** been performed or verified against a live account.
These are human-run steps for the shared [flag template](../docs/FLAG_TEMPLATE.md).

1. In [app.toggly.io](https://app.toggly.io), choose workspace **Toggly Samples**.
   Create **Python FastAPI SDK Sample**, technology **Python**, environment
   **Production**. Set **Application URL** to `http://localhost:8002`; add that
   origin and `http://127.0.0.1:8002` under **Allowed Web Origins** only if the
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
FastAPI claims/country/browser/language/OS columns stay OFF without explicit mapping.

## Versions and verification

Latest stable/published checkpoint: **2026-09-10**.
[Python](https://www.python.org/downloads/) 3.14.7,
[FastAPI](https://pypi.org/project/fastapi/) 0.141.1,
[toggly](https://pypi.org/project/toggly/) 0.7.0,
[toggly-fastapi](https://pypi.org/project/toggly-fastapi/) 0.3.0,
[Uvicorn](https://pypi.org/project/uvicorn/) 0.52.4, Jinja 3.1.6, Starlette 1.6.0, AnyIO 4.15.1,
itsdangerous 2.2.0, python-multipart 0.0.32, python-dotenv 1.2.3,
cryptography 50.0.1. HTTPX 0.28.1 runs native ASGI/HTTP tests; build 1.6.1 and
setuptools 84.0.0 package the sample. Published SDKs come from PyPI only.

`requirements.in` pins direct dependencies; `requirements.txt` locks every
transitive version and artifact hash. `pyproject.toml` defines the sample wheel.
Update direct pins in both manifests, then regenerate:

```bash
uv pip compile requirements.in --python 3.14 --generate-hashes --output-file requirements.txt
```

Dependabot tracks these pip manifests. Verify with placeholders and no account:

```bash
python -m pip check
python scripts/verify_lock.py
python -m unittest discover -s tests -v
python -m compileall -q showcase tests scripts asgi.py
python -m build --wheel
python scripts/smoke.py
```

The production build is the wheel, with templates and CSS. The smoke extracts it
into a temporary directory, starts two actual Uvicorn workers with a generated
process-only signing secret and placeholder app key, checks HTTP sessions/forms/
CSRF/static assets/native gates, and shuts down both workers. Native tests also
exercise signed localhost definitions, tampering, ETag/last-good/recovery, polling,
initial OFF defaults, initial variant context, cancellation and client closure.
No test requires a live app or database.

For a production-host walkthrough with your configured ignored `.env`:

```bash
uvicorn asgi:application --host 127.0.0.1 --port 8002 --workers 2
```

Use a stable `SAMPLE_SESSION_SECRET`. HttpOnly and SameSite=Lax stay enabled;
`SAMPLE_HTTPS=0` allows localhost HTTP. Set it to 1 behind HTTPS in an adapted app.
Keep the local persona controls off public origins.

## Manual checklist

- [ ] Blank key starts with the banner, all sections, sixteen flags and eleven rows.
- [ ] Single/disabled/Any/All/negate results match the documented offline fixture.
- [ ] Real new-dashboard changes appear after applied configuration, refresh and reload.
- [ ] Enhanced POST changes once when enabled; disabled returns 403 before mutation.
- [ ] POST without CSRF fails; GET cannot mutate the session counter.
- [ ] Alice passes native Targeting; Bob/anonymous are denied; independent sessions stay isolated.
- [ ] Clear removes persona/preset/Order without changing process-wide identity.
- [ ] VIP/standard/missing and same-request copies show true/false/false.
- [ ] Both presets expose actual native/explicit results and honest DeviceType/kind limitations.
- [ ] Native dependency/router/decorator/switch routes and OpenAPI behave as described.
- [ ] Explicit remote assignment shows an actual variant or absence; no fake named result.
- [ ] Packaged two-worker Uvicorn serves CSS/forms and shuts down normally.
- [ ] Local env, venv, caches, generated builds and secrets remain ignored.
- [ ] Dedicated app creation, approvals and actual management-to-SDK behavior are verified separately.
