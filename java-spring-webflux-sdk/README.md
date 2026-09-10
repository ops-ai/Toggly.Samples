# Java Spring WebFlux SDK Sample

An eight-section workshop built with the **published native WebFlux adapter**,
Spring WebFlux and Reactor Netty. Native `TogglyContextFilter` wraps native
`FeatureGateFilter` beans in the actual Spring host. Controllers use the real
`ReactiveTogglyClient`, including across delayed scheduler boundaries.
FreeMarker renders evaluated results. There is no Spring Boot starter dependency.

## Quick start

Install **OpenJDK 26.0.2.1**, **Maven 3.9.12**, and Python 3. Set `JAVA_HOME`
and put its `bin` on `PATH`. JDK downloads: [jdk.java.net/26](https://jdk.java.net/26/).

```sh
cd java-spring-webflux-sdk
java --version
mvn --version
cp .env.example .env
# Optional now: set your own application key in .env.
set -a
. ./.env
set +a
mvn -B --no-transfer-progress clean verify
python3 scripts/check-dependencies.py
java -jar target/java-spring-webflux-sdk.jar
```

Open [http://localhost:8089](http://localhost:8089). The sample binds loopback
only. Keep `target/lib/` beside the thin executable JAR when copying the package.
Ctrl-C stops Reactor Netty, closes Spring and then closes the SDK client/provider.

Without a key all eight sections render a **Missing TOGGLY_APP_KEY** banner with
false/absent flags. Protected gate routes, native routes, refresh and submit
return **503**. `/api/evaluate` remains available with `configured=false`. No
synthetic enabled flags, fake app key or Toggly network requests are used by
keyless mode. Test fixtures run only under test sources with ephemeral keys.

## Versions and reproducibility

Official Maven Central metadata and published artifacts checked 2026-09-10:

| Component | Version |
|---|---|
| OpenJDK / compiler release | 26.0.2.1 / 26 |
| Maven | 3.9.12 |
| io.toggly:toggly-core | 1.5.1 |
| io.toggly:toggly-spring-webflux | 1.5.1 |
| Spring Framework BOM / WebFlux | 7.0.9 |
| Reactor BOM | 2025.0.7 |
| reactor-core / reactor-test | 3.8.7 |
| reactor-netty-http | 1.3.7 |
| FreeMarker | 2.3.35 |
| JUnit Jupiter | 6.0.3 |

These are stable host versions; Spring 7.1.0-M1, Reactor Netty 1.4.0-M1 and
Reactor BOM 2026.0.0-M1 are prereleases. Ordinary Spring/Reactor BOM dependency
management aligns transitive dependencies; no SDK source replacement is used.
`pom.xml` pins dependencies and build plugins. `dependencies.lock.json` records
all resolved runtime/test artifact paths and SHA-256 checksums because Maven has
no native lockfile. CI only compares it. After a deliberate dependency upgrade,
review the graph and run `python3 scripts/check-dependencies.py --write`, review
the lock diff and rerun tests. Plugin versions are pinned in the POM, outside
the dependency byte inventory.

## Create the dedicated Toggly application

1. At [app.toggly.io](https://app.toggly.io), select workspace **Toggly Samples**.
2. Create **Java Spring WebFlux SDK Sample**. Choose **Java** technology.
3. Use environment **Production**.
4. Set Allowed Web Origins to **http://localhost:8089** and **http://127.0.0.1:8089**. Server-side definitions
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
| `enhanced-submit` | Baseline environment toggle for the native filtered submit action |
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

1. Configure your application and enable `new-dashboard` in Production.
2. On **Spring WebFlux integration**, request native definitions refresh or wait
   up to 60 seconds for the next HTTP poll, then reload Home.
3. In Declarative gates, Feature is ON and its route returns 200. Negate returns 404.
4. Disable the flag and refresh: those outcomes reverse.
5. Toggle `api-v2` independently: ANY allows either flag, ALL requires both.
6. Read `NativeSdkConfig.java` for the native route filter beans and `WebConfig.java`
   for their actual Spring ordering. Read the dashboard branch in `workshop.ftlh`.
7. Try `/native/reactive?preset=matching` (`alice:true`) and `?preset=nonmatching`
   (`bob:false`) with the shared filter-targeting recipe. This endpoint deliberately
   crosses a delay boundary before using the native Reactor context and client.

Refresh completion means an attempted refresh, not proof of a new accepted
snapshot. Inspect the current flags and cumulative error warning after refresh.

## Sections and routes

| Route | What to explore |
|---|---|
| `/` | Eight-section map, exercise, sixteen-key checklist and current snapshot |
| `/gates` | Native feature/negate/ALL/ANY filters, actual template branch, variants boundary |
| `/programmatic` | Reactive isEnabled/evaluateAll/gates/switchOn and enhanced action |
| `/identity` | Session presets, custom identity/claims/request inputs and clear |
| `/orders` | Same user, VIP/standard/missing Order comparisons |
| `/filters` | Eleven native filters, exact Matching/Non-matching presets |
| `/webflux` | Native pipeline, offloading, delayed context, enabledFeatures Flux, refresh |
| `/configuration` | Setup, missing-key banner, initialization/default/error explanation |
| `/gated/feature`, `/gated/negate` | Native new-dashboard gate or negation; disabled returns 404 |
| `/gated/all`, `/gated/any` | Native ALL/ANY of new-dashboard and api-v2 |
| `/gated/beta`, `/gated/unknown` | Native beta-access or absent-key gate |
| `GET /native/reactive` | Native isEnabled after delay; identity:Boolean response |
| `GET /native/enabled` | Native enabledFeatures Flux collected for this request |
| `GET /api/evaluate` | Delayed snapshot JSON with identity, Order and sixteen results |
| `GET /api/flag/{key}` | Native isEnabled and getFeatureDefinition; absent=false |
| `POST /context` | Save/clear demo session inputs and redirect 303 to Identity |
| `POST /actions/submit` | Native enhanced-submit gate with 403, then lazy ifEnabled action; no persistence |
| `POST /api/refresh` | Native reactive refresh; JSON attemptCompleted |

## User and entity context

`DemoContextResolver` implements the native `ReactiveContextResolver`. It awaits
WebSession/form data and constructs a fresh immutable EvaluationContext before
the native context filter installs it in Reactor context. Native gates therefore
see the user's inputs on their first evaluation. The session stores a persona,
never evaluated flag results. Request-only query overrides do not mutate it.
There is no global identity setter or request ThreadLocal. Context survives
scheduler changes because it belongs to the subscription.

These controls simulate identities; they are **not authentication or authorization**.
Derive actual identity/claims from trusted authenticated server state, and country
from a trusted proxy. Anonymous requests retain unknown identity and read actual
User-Agent, Accept-Language and cf-ipcountry headers when present.

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
same user context. `?order=vip`, `?order=standard` and `?order=missing` change only the current
request. Missing entity context fails closed. The published engine does not compare the
entity kind with the definition kind: an Unknown entity with Vip=true can still
match. This app constructs Order explicitly at its boundary; do not rely on the
SDK to validate entity kind. The integration suite records this native limitation.

## Native SDK and application responsibilities

- **Native context filter:** `TogglyContextFilter(new DemoContextResolver())` is a
  real Spring `WebFilter` bean at order -100. The resolver is a supported native
  extension implemented by this sample.
- **Application offloading:** an order -90 `WebFilter` uses
  `Mono.defer(() -> chain.filter(exchange)).subscribeOn(Schedulers.boundedElastic())`
  before native gates. The order -80 missing-key guard returns 503 for protected examples.
- **Native gates:** order 0 `FeatureGateFilter` beans exercise `features`, exact
  `pathPattern`, `matchAll`, `matchAny`, `negate` and `blockedStatus`. Exact paths
  are intentional; the adapter's simple wildcard matcher is not the host router.
- **Native reactive client:** a real bean wraps the single core client. Controllers
  use `isEnabled`, `evaluateAll`, `allEnabled`, `anyEnabled`, `switchOn`, `ifEnabled`,
  `enabledFeatures`, `getFeatureKeys`, `getFeatureDefinition` and `refresh`.
  The tests also exercise `noneEnabled` and explicit-context `gate`.
- **Application views:** controller code awaits `evaluateAll` and adds `features`
  to the FreeMarker model. FreeMarker branches are application composition;
  evaluation is native. Hidden HTML is not protection: native route filters
  check again before an action can run.
- **Native core:** signed HTTP definitions/JWKS verification, local filters,
  false defaults, last-good retention, polling and lifecycle.
- **Unsupported:** core/WebFlux 1.5.1 provides no native variant allocation.
  `switchOn` selects one of two caller publishers using a Boolean result;
  telemetry variant labels do not allocate an experiment.

## Cold fetch, asynchronous work and cancellation

Reactive return types do not make the SDK transport inherently nonblocking.
Most native wrapper methods defer synchronous core evaluation. The HTTP provider
can fetch when its snapshot is empty, using fixed 10-second connect and 30-second
read timeouts. Startup performs synchronous preload **before** binding the server;
failed preload leaves false defaults and a visible warning. The outer offload
filter protects native gates even if preload failed.

An async delay can move later work onto a Reactor nonblocking thread. Each
potentially cold controller operation therefore has its **own deferred offload**:

```java
Mono.delay(Duration.ofMillis(15))
    .then(TogglyContextFilter.getContext())
    .flatMap(context -> Mono.defer(() -> reactive.isEnabled("filter-targeting"))
        .subscribeOn(Schedulers.boundedElastic()));
```

The native context stays attached across this boundary. Do not call `block()`
inside a handler or bridge through core ContextHolder. Avoid shared mutable user
state and stale per-user Boolean caches. The native `refresh()` method already
uses boundedElastic internally.

Cancelling a subscription stops downstream delivery and queued work. An already
running synchronous HTTP call may continue until it completes or times out;
offloading does not make it cancellable network I/O. Cancellation does not close
the shared client, so other users can continue. The actual-host test cancels a
socket request after evaluating Alice/VIP and confirms the cancellation reaches
the handler, then checks Bob/standard and anonymous requests.

The runtime is the sole owner of the core client and its default HTTP provider.
The reactive wrapper borrows it, so its Spring bean disables inferred destruction
(`@Bean(destroyMethod="")`). Calling wrapper.close would close the underlying
client. Shutdown stops the listening socket, closes the tracked accepted connections to
cancel active subscriptions, closes Spring and closes the owner once. A
stay-closed ChannelGroup also catches connections racing with shutdown.
The tests prove active requests are cancelled and native polling stops after shutdown. A separate per-use wrapper
must not close an application-owned client.

## Refresh and errors

Pages reevaluate the current snapshot and context on each request. Native HTTP
polling runs every 60 seconds; the browser refresh button requests an immediate
attempt. Session inputs persist, evaluated results do not. This sample disables
WebSocket updates, telemetry and automatic context registration; signed
verification remains enabled and dashboard provisioning is explicit.

Invalid initial definitions show zero definitions and false defaults. Later
network/signature failures retain the last valid signed snapshot. The redacted
error count is cumulative and remains visible after recovery. An empty snapshot
may trigger further synchronous fetches, so an unavailable service can delay
responses despite the event loop being protected. No live account availability
is implied by a rendering page or a completed refresh attempt.

## Source-reading map

| File | Purpose |
|---|---|
| `src/main/java/sample/Catalog.java` | Shared sixteen keys, exact User-Agents and Order shape |
| `src/main/java/sample/SampleRuntime.java` | Keyless mode, signed client setup, preload and ownership |
| `src/main/java/sample/Main.java` | Real Spring context/Reactor Netty socket server and shutdown |
| `src/main/java/sample/WebConfig.java` | Native context ordering, deferred offload, keyless guard and views |
| `src/main/java/sample/NativeSdkConfig.java` | Real native filter and ReactiveTogglyClient beans |
| `src/main/java/sample/DemoContextResolver.java` | Async session/form resolution and immutable context |
| `src/main/java/sample/ShowcaseController.java` | Native publishers, delayed request work, Order comparisons |
| `src/main/resources/templates/workshop.ftlh` | Escaped teaching UI consuming actual native evaluations |
| `src/main/resources/static/workshop.js` | Progressive refresh feedback |
| `src/test/java/sample/DefinitionsServer.java` | Signed loopback transport with ephemeral EC keys |
| `src/test/java/sample/NativeIntegrationTest.java` | Eight pages, eleven filters, gates, sessions, signing, polling |
| `src/test/java/sample/ReactiveIsolationTest.java` | Concurrent async users/Orders, cancellation, error cleanup, cold offload |
| `src/test/java/sample/ShowcaseTest.java` | Keyless startup/denial |
| `src/test/java/sample/PackagedProbe.java` | Signed configured host with application loaded from production JAR |
| `scripts/check-dependencies.py`, `scripts/smoke.py` | Dependency bytes and production-process HTTP smoke |

## Verification

```sh
mvn -B --no-transfer-progress clean verify
python3 scripts/check-dependencies.py
python3 scripts/smoke.py
java -cp "target/test-classes:target/java-spring-webflux-sdk.jar:target/lib/*" sample.PackagedProbe
```

The tests use real published packages and deterministic signed loopback HTTP.
Private signing keys exist only in test memory. The fixtures change beta-access
and enhanced-submit to Alice-targeted rules **only to prove first-evaluation
context reaches native gates**; the live recipe keeps the shared baseline toggles.
The reactive suite uses the actual production host and registered filter beans,
with test-only error/cancel endpoints. Invalid-signature logging is observed on
the evaluating thread to prove cold HTTP is off the Reactor event loop. No test
chain substitutes for host ordering. No live key or external database is needed.
Maven/Sisu may emit a JDK final-field reflection warning. Signature-failure logs
are expected only in deliberate rejection tests.

## Manual checklist

- [ ] Start keyless; all eight sections show setup and protected/native routes/actions return 503.
- [ ] Create the dedicated app, context and sixteen flags, then restart with your ignored local key.
- [ ] Home shows all sixteen definitions, and the first-flag exercise reverses feature/negate outcomes.
- [ ] Toggle api-v2 and verify native ALL/ANY routes; enhanced-submit permits/denies without persistence.
- [ ] Matching/Non-matching give expected eleven-row matrix with explicit Macintosh device limitation.
- [ ] Save Alice/Bob in separate browser profiles; customize and clear one without changing the other.
- [ ] Compare VIP/standard/missing Orders without changing user identity.
- [ ] Delayed native result and enabledFeatures agree with the API and template snapshot.
- [ ] Request refresh, reload Home, and distinguish attempt completion from new accepted definitions.
- [ ] Variants remain labeled unsupported; switchOn is Boolean publisher selection.
- [ ] Ctrl-C exits; no local .env is tracked.

See [Sample Contract](../docs/SAMPLE_CONTRACT.md), [flag template](../docs/FLAG_TEMPLATE.md)
and the [Java SDK guide](https://docs.toggly.io/sdks/java).
