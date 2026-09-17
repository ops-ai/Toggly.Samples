# Java Spring Boot SDK Sample

A standalone Spring Boot workshop using the published
`io.toggly:toggly-spring-boot-starter`. Boot auto-configuration creates the
client. Native `@FeatureEnabled` / `FeatureAspect` and `@ConditionalOnFeature`
are the starter annotations. A request filter installs ContextHolder. Actuator
health and `/actuator/toggly` are the starter's Actuator surfaces on this host.

This is **not** the Spring MVC adapter sample. It does not register
`FeatureGateInterceptor` or `TogglyModelAttribute`.

## Quick start

Install **OpenJDK 17** or newer (verified **17.0.17**), **Maven 3.9.12**, and
Python 3. Set `JAVA_HOME` and add its `bin` to `PATH`.

```sh
cd java-spring-boot-sdk
java --version
mvn --version
cp .env.example .env
# Optional now: edit .env and set your own TOGGLY_APP_KEY.
set -a
. ./.env
set +a
mvn -B --no-transfer-progress clean verify
python3 scripts/check-dependencies.py
java -jar target/java-spring-boot-sdk.jar
```

Open [http://localhost:8090](http://localhost:8090). The host binds loopback
only. Ctrl-C closes the Spring context, which closes the starter client and the
sample-owned HTTP provider.

Without a key, every section remains usable as a setup shell with a **Missing
TOGGLY_APP_KEY** banner. All displayed flags are false/absent, protected gate
routes, the AOP example and refresh/submit actions return **503**. The sample
JSON snapshot remains available with configured=false. Tests create an isolated,
signed loopback definitions service and do not require your `.env`.

## Versions and reproducibility

Verified against official registries on 2026-09-16:

| Component | Version |
|---|---|
| OpenJDK, compiler release | 17.0.17, release 17 |
| Maven | 3.9.12 |
| `io.toggly:toggly-spring-boot-starter` | 1.6.0 (Maven Central latest) |
| `io.toggly:toggly-core` (transitive) | 1.6.0 |
| Spring Boot parent / Actuator / Web / AOP / FreeMarker | **3.5.16** |
| Embedded Tomcat (Boot 3.5.16) | 10.1.55 |

**Host choice.** Published starter 1.6.0 declares `spring-boot.version` 3.5.16.
Latest stable Boot is 4.1.1 (4.2.0-M1 is a milestone). **OPS-1257** re-probed that
combination on 2026-09-16 with Actuator kept on the classpath. When a
`TogglyClient` exists (workshop / `TOGGLY_APP_KEY` path), startup still fails:
`ClassNotFoundException: org.springframework.boot.actuate.health.HealthIndicator`.
Published `TogglyHealthIndicator` implements the Boot 3 type; Boot 4.1.1 moved it
to `org.springframework.boot.health.contributor.HealthIndicator` and removed the
old class from `spring-boot-actuator`. A missing-key Boot 4 process can start,
but `/actuator/health` has no `toggly` component and `/actuator/toggly` is 404 —
that is not a working Actuator host. Do not drop Actuator to hide the CNFE.

Boot 4.1.1 also dropped `spring-boot-starter-aop` from the BOM (no 4.1.1
artifact; the replacement is `spring-boot-starter-aspectj`). Pinning AOP 3.5.16
unblocks Maven only. Native Actuator still dies once the client is created.

This sample therefore stays on the starter's declared **3.5.16** host. A Boot 4
sample needs a published starter that implements Boot 4 health/Actuator
([OPS-1192](https://linear.app/opsai/issue/OPS-1192/w316-spring-boot-4-parallel-starter)).

The starter's `snapshotProvider()` bean returns null. Boot 3.5.16 will not inject
that null into `togglyClient`. `TogglySampleConfiguration` supplies a
Spring-owned `HttpSnapshotProvider` so the **starter** still creates
`TogglyClient`. That is documented host configuration, not a local jar.

Only Maven Central artifacts are consumed. `pom.xml` pins the starter and Boot
parent; `dependencies.lock.json` records the resolved runtime/test graph with
SHA-256 checksums. After a deliberate dependency update, run
`python3 scripts/check-dependencies.py --write`, review the lock, and re-run
the suite. CI never regenerates the lock.

## Create the dedicated Toggly application

1. At [app.toggly.io](https://app.toggly.io), use a workspace you can manage (the one from signup is enough).
2. Create **Java Spring Boot SDK Sample**. Choose **Java** technology.
3. Use environment **Production**.
4. Set **Application URL** to **http://localhost:8090**; add **http://localhost:8090**
   and **http://127.0.0.1:8090** under **Allowed Web Origins** only if the existing
   client-side section is present. Server-side definitions do not use browser CORS.
5. Add context kind **Order** with `Id` (**string, key**), `Vip` (**boolean**),
   and `Total` (**number, optional in sample data**, not an editor checkbox).
6. Add the five application flags below. Create a **Filters** category and add
   the eleven filter flags in the following table.
7. Copy the application key into your ignored `.env` as `TOGGLY_APP_KEY`. Keep
   `TOGGLY_ENVIRONMENT=Production`. Export the file and restart as above.

| Flag | Dashboard configuration |
|---|---|
| `new-dashboard` | Baseline environment toggle; start enabled, then switch off |
| `api-v2` | Baseline environment toggle; switch independently for ALL/ANY gates |
| `enhanced-submit` | Baseline environment toggle for the AOP submit action |
| `ExpressCheckout` | Context kind Order; ContextProperty `Vip`, operator equals, Boolean `true` |
| `beta-access` | Baseline environment toggle for the AOP gate route |
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
`Country:0`. These segment filters and UserClaims require a `Percentage`
parameter; 100 means every matching identity. ContextProperty parameters are
`Property=Vip`, `Operator=eq`, `Value=true`, `ValueType=boolean`, with
`contextKind=Order` on the feature definition. Java's picker omits **Percentage,
Targeting and TimeWindow**. Follow the [shared setup guide](../docs/APP_SETUP.md)
for visible conditions, final save controls, and the authorized single-feature
management API fallback. The SDK app key is not management authorization.

Provisioning is a manual step. The sample's deterministic tests do not establish
that your live app, allowed origins, context catalog or flags have been created.

## First flag exercise

1. Configure the application and enable `new-dashboard` in Production.
2. Open **Spring Boot integration** and press **Request native definitions refresh**,
   or wait up to 60 seconds for the next HTTP poll. Return Home and reload.
3. In **Declarative gates**, the Feature card is ON; its route returns 200.
   The Negate route returns 404.
4. Turn `new-dashboard` off, repeat refresh, and observe the reversed HTTP result.
   The `@ConditionalOnFeature` startup sentence does **not** change until restart.
5. Turn `api-v2` on independently. ANY allows either flag; ALL requires both.
6. Read `FeatureService.java` (`@FeatureEnabled`), then `FeatureBeans.java`
   (`@ConditionalOnFeature`), `TogglySampleConfiguration.java` and `DemoContextFilter.java`.
7. Compare `/native/argument?preset=matching` (`alice:true`) and
   `?preset=nonmatching` (`bob:false`) with filter-targeting.

The sample refresh endpoint calls native `client.refresh()` and reports an
attempted refresh, not proof that a new snapshot was accepted.

## Section and route map

| Section / endpoint | What to explore |
|---|---|
| `/` | Eight-section map, first exercise, sixteen-key checklist, current request snapshot |
| `/gates` | `@FeatureEnabled` Boolean/ALL/ANY, sample HTTP negate, startup vs request copy, variant boundary |
| `/programmatic` | Explicit isEnabled/gate/evaluateAll, native getValue, AOP submit action |
| `/identity` | Matching/Non-matching session presets, custom identity/claim/request inputs, clear |
| `/orders` | VIP and standard Order evaluated side by side; missing entity case |
| `/filters` | Eleven real SDK evaluators, session or request-only presets |
| `/boot` | Starter auto-config, annotations/beans, Actuator, lifecycle and refresh |
| `/configuration` | Missing-key banner and configuration/default/refresh guidance |
| `/gated/feature` | `@FeatureEnabled("new-dashboard")` then HTTP 200/404 |
| `/gated/negate` | Sample invert of that Boolean (starter has no negate) |
| `/gated/all` | `@FeatureEnabled` matchAll=true |
| `/gated/any` | `@FeatureEnabled` matchAll=false |
| `/gated/beta` | `@FeatureEnabled("beta-access")` |
| `GET /native/argument` | `@FeatureEnabled("filter-targeting")` plus current identity |
| `GET /api/flag/{key}` | Sample response from native isEnabled and getFeatureDefinition |
| `POST /api/refresh` | Sample endpoint calling native refresh |
| `GET /api/evaluate` | Sample JSON: identity, Order, configured state and sixteen evaluations |
| `POST /context` | Sample session controls; 303 to Identity |
| `POST /actions/submit` | `@FeatureEnabled("enhanced-submit")`; 200 allowed, 403 disabled, 503 unconfigured |
| `GET /actuator/health` | Native `TogglyHealthIndicator` (process default context) |
| `GET /actuator/toggly` | Native `TogglyEndpoint` list; POST refreshes |

## Identity and Order are different contexts

`DemoContextFilter` is sample composition. The starter has no request interceptor.
It builds a new EvaluationContext per request and clears ContextHolder in
`finally`, including when a later controller throws. There is no process-wide
identity. Actuator evaluations use the client default context, not the browser
session.

Preset controls deliberately simulate authenticated users and HTTP headers;
they are **not authentication or authorization**.

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
Non-matching. **DeviceType Macintosh is unsupported by the published 1.6.0
User-Agent parser**: it recognizes iPhone/iPad/iPod, but returns Other for
desktop Macintosh. We retain the exact shared Macintosh rule; that row shows
the real OFF result. `?preset=matching` affects only that request; POST preset
buttons save the persona in the session.

`/orders` evaluates both Orders using `context.withEntity(...)`. Missing entity
context fails closed. The published engine does not compare the entity kind with
the definition kind: an Unknown entity with Vip=true can still match.

## Native SDK surfaces and sample composition

- **Native:** `TogglyAutoConfiguration` binds `toggly.*` and creates `TogglyClient`
  when `toggly.enabled=true`.
- **Native:** `@FeatureEnabled` + `FeatureAspect` (sample registers the aspect bean).
- **Native:** `@ConditionalOnFeature` / `OnFeatureCondition` at bean creation time.
- **Native:** `TogglyHealthIndicator` and `TogglyEndpoint` when Actuator is on the
  classpath (Boot 3.5.16 only for this published starter).
- **Native core:** signed HTTP definitions, local evaluation, defaults, last-valid
  snapshot retention, polling and explicit-context calls.
- **Sample composition:** `HttpSnapshotProvider` bean, signed `TogglyConfig`
  (properties omit `useSignedDefinitions`), `DemoContextFilter`, HTTP 404/403
  translation, FreeMarker workshop, session controls, and the missing-key guard.
- **Unsupported:** core/starter 1.6.0 has no variant allocation API.
  `@FeatureEnabled` has no negate or HTTP status. The starter has no MVC
  interceptor, argument resolver, or model advice.

## Environment variables

| Name | Role |
|---|---|
| `TOGGLY_APP_KEY` | SDK application key. Blank keeps `toggly.enabled=false`. Not a public browser key and not management authorization. |
| `TOGGLY_ENVIRONMENT` | Defaults to `Production`. |
| `TOGGLY_BASE_URL` | Definitions origin. Defaults to `https://definitions.toggly.io`. Tests point this at a loopback signer. |

`application.yml` documents the same names. There is no `NEXT_PUBLIC_` (or similar)
browser-exposure prefix; this is a server-rendered app.

## Loading, refresh and lifetime

Startup performs a signed refresh. A missing or invalid initial snapshot yields
false defaults and a visible warning. With valid definitions, SDK polling runs
every 60 seconds. This sample disables WebSocket updates, telemetry and automatic
schema registration. Failed refreshes retain the last valid signed definitions.
Error counts are cumulative and do not reset on recovery.

## Read the source in this order

| File | Why it exists |
|---|---|
| `src/main/java/sample/Catalog.java` | Exact shared flag names, preset User-Agents and Order shape |
| `src/main/resources/application.yml` | Boot properties, Actuator exposure, missing-key default |
| `src/main/java/sample/Application.java` | Production Boot host and test `start` helper |
| `src/main/java/sample/TogglySampleConfiguration.java` | Signed config, HTTP provider, FeatureAspect, initial refresh |
| `src/main/java/sample/DemoContextFilter.java` | Request-scoped ContextHolder install and cleanup |
| `src/main/java/sample/FeatureService.java` | Native `@FeatureEnabled` methods |
| `src/main/java/sample/FeatureBeans.java` | Native `@ConditionalOnFeature` startup beans |
| `src/main/java/sample/ShowcaseController.java` | HTTP translation, programmatic calls, Order comparisons |
| `src/main/resources/templates/workshop.ftlh` | Escaped FreeMarker view |
| `src/test/java/sample/NativeIntegrationTest.java` | Native gates, presets, concurrency, Actuator, signed refresh |

## Verification

```sh
mvn -B --no-transfer-progress clean verify
python3 scripts/check-dependencies.py
python3 scripts/smoke.py
java -cp target/test-classes sample.PackagedProbe
```

The fixture changes `beta-access` and `enhanced-submit` to alice-targeted rules
solely to prove identity is installed before the first AOP evaluation. The live
app recipe uses the baseline toggles required by the shared contract. CI requires
no live Toggly service, app credentials or external database.

## Manual checklist

- [ ] Start without a key; every section renders a banner; gated routes, AOP example, refresh and submit return 503.
- [ ] Configure the dedicated app, context kind and all sixteen flags; restart with a local key.
- [ ] Home shows sixteen checklist rows with present definitions and current request results.
- [ ] Complete the first-flag exercise; feature/negate and ALL/ANY routes agree with their cards.
- [ ] Toggle enhanced-submit; action is allowed/denied without persisting a real order.
- [ ] Matching and Non-matching controls show the expected matrix (Macintosh device gap labeled).
- [ ] Open two browser profiles, save Alice/Bob independently, and verify neither session overwrites the other.
- [ ] VIP and standard Orders yield different ExpressCheckout results; missing entity is OFF.
- [ ] `/actuator/health` includes toggly; `/actuator/toggly` lists features. Those endpoints are not request-scoped.
- [ ] Confirm variants are marked unsupported and Boot 4 Actuator incompatibility is described.
- [ ] Interrupt the process and confirm shutdown exits; real `.env` remains ignored.

See the shared [Sample Contract](../docs/SAMPLE_CONTRACT.md) and
[flag template](../docs/FLAG_TEMPLATE.md), plus the
[Java SDK guide](https://docs.toggly.io/sdks/java).
