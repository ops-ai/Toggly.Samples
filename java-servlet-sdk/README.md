# Java Servlet SDK Sample

A standalone, server-rendered workshop using the published Java core and Servlet
SDKs. Embedded Tomcat runs the actual listener, context filter, feature-gate
filter and API servlet. No Spring adapter is involved.

## Quick start

Install **OpenJDK 26.0.2.1**, **Maven 3.9.12**, and Python 3 (dependency verification
and packaged smoke). Set `JAVA_HOME` to the JDK installation and add its `bin` to
`PATH`. The official build is available at [jdk.java.net/26](https://jdk.java.net/26/).

```sh
cd java-servlet-sdk
java --version
mvn --version
cp .env.example .env
# Optional now: edit .env and set your own TOGGLY_APP_KEY.
set -a
. ./.env
set +a
mvn -B --no-transfer-progress clean verify
python3 scripts/check-dependencies.py
java -jar target/java-servlet-sdk.jar
```

Open [http://localhost:8086](http://localhost:8086). The host binds loopback only.
Keep `target/lib/` beside the JAR when copying the production package; it is a
thin executable JAR with a manifest classpath. Ctrl-C invokes Tomcat shutdown
and the native listener closes the SDK client and its owned refresh scheduler.

Without a key, every section remains usable as a setup shell with a **Missing
TOGGLY_APP_KEY** banner. All displayed flags are false/absent, protected gate
routes return **503**, and the native API returns **503**. No synthetic feature
state or fabricated application key is used in the running app. Tests create an
isolated, signed loopback definitions service and do not require your `.env`.

## Versions and reproducibility

Verified against official registries on 2026-09-10:

| Component | Version |
|---|---|
| OpenJDK, compiler release | 26.0.2.1, release 26 |
| Maven | 3.9.12 |
| `io.toggly:toggly-core` | 1.5.1 |
| `io.toggly:toggly-servlet` | 1.5.1 |
| `org.apache.tomcat.embed:tomcat-embed-core` | 11.0.25 |
| Jakarta Servlet API supplied by Tomcat | 6.1 |
| JUnit Jupiter | 6.0.3 |

Only Maven Central artifacts are consumed. `pom.xml` pins direct dependencies
and build plugins; `dependencies.lock.json` records the complete resolved
runtime/test dependency graph with SHA-256 checksums. The verification script
uses the standard Maven repository layout. After a deliberate dependency update,
review the graph and run `python3 scripts/check-dependencies.py --write`, then
review the lock diff and re-run the suite. CI never regenerates the lock.
The lock covers dependencies, while plugin versions are fixed in the POM.

## Create the dedicated Toggly application

1. At [app.toggly.io](https://app.toggly.io), select workspace **Toggly Samples**.
2. Create **Java Servlet SDK Sample**. Choose **Java** technology.
3. Use environment **Production**.
4. Set Allowed Web Origins to **http://localhost:8086**. Server-side definitions
   do not use browser CORS, but keep the app's origin aligned with this sample.
5. Add context kind **Order** with `Id` (**string, key**), `Vip` (**boolean**),
   and `Total` (**number, optional**).
6. Add the five application flags below. Create a **Filters** category and add
   the eleven filter flags in the following table.
7. Copy the application key into your ignored `.env` as `TOGGLY_APP_KEY`. Keep
   `TOGGLY_ENVIRONMENT=Production`. Export the file and restart as above.

| Flag | Dashboard configuration |
|---|---|
| `new-dashboard` | Baseline environment toggle; start enabled, then switch off |
| `api-v2` | Baseline environment toggle; switch independently for ALL/ANY gates |
| `enhanced-submit` | Baseline environment toggle for the programmatic submit action |
| `ExpressCheckout` | Context kind Order; ContextProperty `Vip`, operator equals, Boolean `true` |
| `beta-access` | Baseline environment toggle for the native gate route |
| `filter-always-on` | AlwaysOn |
| `filter-percentage` | Percentage: 50%, sticky by user identity |
| `filter-targeting` | Targeting: users includes `alice`; no other audience or default rollout |
| `filter-user-claims` | UserClaims: Claim `role`, Value `admin`, segment Percentage 100 |
| `filter-time-window` | TimeWindow: 2020-01-01T00:00:00Z through 2099-12-31T23:59:59Z |
| `filter-country` | Country US, segment Percentage 100 |
| `filter-browser-family` | BrowserFamily Chrome, segment Percentage 100 |
| `filter-browser-language` | BrowserLanguage en, segment Percentage 100 |
| `filter-device-type` | DeviceType Macintosh, segment Percentage 100 |
| `filter-os` | OperatingSystem Mac, segment Percentage 100 |
| `filter-context-property` | Context kind Order; ContextProperty `Vip`, operator equals, Boolean `true` |

In the signed definitions wire format, segment lists use indexed keys such as
`Country:0`, `BrowserFamily:0`, `BrowserLanguage:0`, `DeviceType:0` and
`OperatingSystem:0`. These segment filters and UserClaims require a `Percentage`
parameter; 100 means every matching identity. ContextProperty parameters are
`Property=Vip`, `Operator=eq`, `Value=true`, `ValueType=boolean`, with
`contextKind=Order` on the feature definition. The test fixture demonstrates
these exact shapes. Use dashboard rule controls when creating your live app.

Provisioning is a manual step. The sample's deterministic tests do not establish
that your live app, allowed origins, context catalog or flags have been created.

## First flag exercise

1. Configure the application and enable `new-dashboard` in Production.
2. Open **Servlet integration** and press **Request native definitions refresh**,
   or wait up to 60 seconds for the next HTTP poll. Return Home and reload.
3. In **Declarative gates**, the Feature card is ON; its route returns 200.
   The Negate route returns 404.
4. Turn `new-dashboard` off, repeat refresh, and observe the reversed result.
5. Turn `api-v2` on independently. ANY allows either flag; ALL requires both.
6. Read the `gate(...)` registrations in `Main.java` and the explicit
   `client.isEnabled(key, context)` call in `ShowcaseServlet.java`.

The native refresh response reports an attempted refresh, not proof that a new
snapshot was accepted. A redacted cumulative warning appears after a failed
fetch or signature check. Compare current definitions and gate results after
refresh rather than trusting only the word `refreshed` in native JSON.

## Section and route map

| Section / endpoint | What to explore |
|---|---|
| `/` | Eight-section map, first exercise, sixteen-key checklist, current request snapshot |
| `/gates` | Boolean, negate and ALL/ANY cards; ordinary conditional HTML; variant capability boundary |
| `/programmatic` | Explicit isEnabled/gate/evaluateAll calls, native getValue, submit action |
| `/identity` | Matching/Non-matching session presets, custom identity/claim/request inputs, clear |
| `/orders` | VIP and standard Order evaluated side by side; missing entity case |
| `/filters` | Eleven real SDK evaluators, session or request-only presets |
| `/servlet` | Native pipeline, lifecycle and JSON/refresh controls |
| `/configuration` | Missing-key banner and configuration/default/refresh guidance |
| `/gated/feature` | Native `new-dashboard` gate |
| `/gated/negate` | Native `new-dashboard`, negate=true |
| `/gated/all` | Native `new-dashboard,api-v2`, requirement=ALL |
| `/gated/any` | Native `new-dashboard,api-v2`, requirement=ANY |
| `/gated/beta` | Native `beta-access` gate |
| `GET /api/features` | Actual `TogglyServlet`, evaluateAll with request context |
| `GET /api/features/{key}` | Actual `TogglyServlet`, enabled/existence/filter count |
| `POST /api/features/refresh` | Actual `TogglyServlet`, refresh attempt |
| `GET /api/evaluate` | Sample JSON: identity, Order, configured state and sixteen evaluations |
| `POST /context` | Sample session controls; 303 to Identity |
| `POST /actions/submit` | Sample action guard; 200 allowed, 403 disabled, 503 unconfigured; no persistence |
| `/style.css`, `/workshop.js` | Local stylesheet and progressive native-refresh form feedback |

## Identity and Order are different contexts

`DemoContextFilter` overrides the native `createContext` extension point and
inherits the native `doFilter` implementation with its `finally` cleanup. It is
registered **before** every native gate. A session holds one immutable demo
persona. Each request builds a new `EvaluationContext` with identity, claims,
request fields and a typed `TogglyEntityContext`. There is no global identity
setter and no per-flag result cache.

Preset controls deliberately simulate authenticated users and HTTP headers;
they are **not authentication or authorization**. In a production application,
use trusted principal/JWT data and trusted proxy metadata. On the first anonymous
request, the sample takes User-Agent, Accept-Language and cf-ipcountry from the
request when present. Anonymous identity stays unknown rather than being guessed.

| Input | Matching | Non-matching |
|---|---|---|
| Identity | alice | bob |
| Claim | role=admin | role=user |
| Country | US | CA |
| Accept-Language | en-US,en;q=0.9 | fr-FR,fr;q=0.9 |
| User-Agent | Chrome 120 / macOS 10.15.7 | Firefox 121 / Windows 10 |
| Entity | Order / ord-vip / Vip=true / Total=250 | Order / ord-standard / Vip=false / Total=75 |

Exact User-Agent values, also in `Catalog.java`:

```text
Matching: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Non-matching: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0
```

With the recipe above, AlwaysOn and TimeWindow stay ON for both presets.
Percentage is stable for the same user/flag, but its exact Alice/Bob outcome is
not prescribed. The other seven supported rows turn ON for Matching and OFF for
Non-matching. **DeviceType Macintosh is unsupported by the published 1.5.1
User-Agent parser**: it recognizes iPhone/iPad/iPod, but returns Other for
desktop Macintosh. We retain the exact shared Macintosh rule and User-Agent;
that row shows the real OFF result and an explicit capability note. No fallback
evaluator or fake matching result is used. `?preset=matching` or `?preset=nonmatching` affects only that
request; POST preset buttons save the persona in the session.

`/orders` evaluates both Orders using `context.withEntity(...)`, preserving the
same user context. `?order=vip` and `?order=standard` change only the current
request. Missing entity context fails closed. The published engine does not compare the
entity kind with the definition kind: an Unknown entity with Vip=true can still
match. This app constructs Order explicitly at its boundary; do not rely on the
SDK to validate entity kind. The integration suite records this native limitation.

## Native SDK surfaces and sample composition

- **Native:** `TogglyServletContextListener` initializes the client before filter
  initialization and closes it on shutdown. `SampleLifecycle` overrides only
  configuration and the missing-key startup branch.
- **Native:** `TogglyContextFilter` installs and clears `ContextHolder` around
  the synchronous request. `DemoContextFilter` supplies complete demo inputs.
- **Native:** `FeatureGateFilter` handles features, ALL/ANY, negate and 404
  denial. Its no-client behavior is permissive, so the sample explicitly denies
  `/gated/*` with 503 before entering that filter when unconfigured.
- **Native:** `TogglyServlet` handles all/single feature JSON and refresh POST.
- **Native core:** signed HTTP definitions/JWKS verification, local evaluation,
  defaults, last-valid snapshot retention, polling and explicit-context calls.
- **Sample composition:** HTML cards/branches, session forms, JSON wrapper,
  status warnings, setup guidance, and action guard. There is no native Servlet
  template-tag API.
- **Unsupported:** core/servlet 1.5.1 has no variant allocation/getVariant API.
  `getValue` picks one of two caller values from a Boolean result. Telemetry
  variant labels are not experiment allocation. The variant section explains
  this boundary instead of synthesizing an experiment.

The host uses synchronous Servlet requests. ContextHolder is thread-local;
it does not flow automatically into arbitrary executors or Servlet async
processing. Use explicit immutable `EvaluationContext` when moving evaluation
outside the current worker. Native cleanup is tested after real HTTP errors and
concurrent requests on a reused, eight-thread Tomcat pool.

## Loading, refresh and lifetime

Startup performs a signed refresh. A missing or invalid initial snapshot yields
false defaults and a visible warning. The provider may fetch again while its
snapshot is empty; an unavailable live service can therefore delay page loads.
The published HTTP provider currently uses fixed 10-second connect and 30-second
read timeouts. The UI does not claim that a loading shell proves connectivity.

With valid definitions, SDK polling runs every 60 seconds and each new page/API
request evaluates the current snapshot. This sample disables WebSocket updates,
telemetry and automatic schema registration: no key-bearing WebSocket URL is
logged, and dashboard provisioning is explicit. Signed definitions are enabled.
Failed refreshes retain the last valid signed definitions. Error counts shown
in the banner are cumulative and do not reset on recovery. Refresh does not
rewrite sessions or retain evaluated results between users or Orders.

## Read the source in this order

| File | Why it exists |
|---|---|
| `src/main/java/sample/Catalog.java` | Exact shared flag names, preset User-Agents and Order shape |
| `src/main/java/sample/SampleLifecycle.java` | Environment → signed native client → native close; keyless behavior |
| `src/main/java/sample/Main.java` | Tomcat setup and native listener/filter/servlet registration order |
| `src/main/java/sample/DemoContextFilter.java` | Session/request inputs → immutable context before evaluation |
| `src/main/java/sample/ShowcaseServlet.java` | Programmatic evaluation and guarded sample action |
| `src/main/java/sample/Views.java` | Every workshop section and contextual status/HTML encoding |
| `src/main/resources/style.css` | Responsive accessible layout without a frontend toolchain |
| `src/main/resources/workshop.js` | Show native refresh feedback inline; retain native POST without JavaScript |
| `src/test/java/sample/DefinitionsServer.java` | Ephemeral EC signer + local HTTP definitions/JWKS; no fake evaluator |
| `src/test/java/sample/NativeIntegrationTest.java` | Native gates, presets, concurrency, errors, signed refresh and lifecycle |
| `src/test/java/sample/ShowcaseTest.java` | Missing-key startup and denial regression |
| `scripts/check-dependencies.py` | Exact dependency graph/checksum verification |
| `src/test/java/sample/PackagedProbe.java` | Native configured checks loading Main from the packaged JAR |
| `scripts/smoke.py` | Starts packaged JAR, walks HTTP pages/denials and shuts down |

## Verification

```sh
mvn -B --no-transfer-progress clean verify
python3 scripts/check-dependencies.py
python3 scripts/smoke.py
java -cp "target/test-classes:target/java-servlet-sdk.jar:target/lib/*" sample.PackagedProbe
```

The fixture changes `beta-access` and `enhanced-submit` to alice-targeted rules
solely to prove the native filter/action sees identity before first evaluation.
The live app recipe uses the baseline toggles required by the shared contract.
All sixteen definitions, eleven filters and signatures use the actual installed
SDK. Cryptographic private keys are generated only in test memory. CI requires
no live Toggly service, app credentials or external database.

Maven/Sisu may emit a JDK final-field reflection warning, and Tomcat may warn that
optional ThreadLocal/RMI leak inspection needs module opens. The checks do not
suppress those warnings or weaken the native request cleanup assertions.

## Manual checklist

- [ ] Start without a key; every section renders a banner, all gated routes and native API return 503.
- [ ] Configure the dedicated app, context kind and all sixteen flags; restart with a local key.
- [ ] Home shows sixteen checklist rows with present definitions and current request results.
- [ ] Complete the first-flag exercise; feature/negate and ALL/ANY routes agree with their cards.
- [ ] Toggle enhanced-submit; action is allowed/denied without persisting a real order.
- [ ] Matching and Non-matching controls show the expected matrix (Macintosh device gap explicitly labeled); repeated identity keeps Percentage sticky.
- [ ] Open two browser profiles, save Alice/Bob independently, and verify neither session overwrites the other.
- [ ] Customize/clear identity; the next native/API evaluation sees the new context.
- [ ] VIP and standard Orders yield different ExpressCheckout results in the same page; missing entity is OFF.
- [ ] Native all/single feature JSON agree with Home; request refresh, then reload to observe current values.
- [ ] Confirm variants are marked unsupported and getValue is described as Boolean value selection.
- [ ] Interrupt the process and confirm shutdown exits; real `.env` remains ignored.

See the shared [Sample Contract](../docs/SAMPLE_CONTRACT.md) and
[flag template](../docs/FLAG_TEMPLATE.md), plus the
[Java SDK guide](https://docs.toggly.io/sdks/java).
