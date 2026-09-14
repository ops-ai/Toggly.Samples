# JavaScript SDK live acceptance

This is an engineering acceptance runner for published NestJS, SolidJS/SolidStart and SvelteKit SDKs. It is **not a customer Sample UI**. A successful run proves the selected public SDK runtime path; connected customer Sample Feature/negate rendering, framework hydration/navigation, and real application actions remain a separate pending acceptance leg.

Node 24 and Chromium are required. Dependencies are exact public npm references with a registry lock; SDK source files and local SDK tarballs are never imported. The optional framework build dependencies resolve published adapter peers and bundle the browser probe. The Nest leg uses an application context and request-scoped services, without an HTTP listener or upload middleware.

## Install and validate harness mechanics

```sh
npm ci
npm run format:check
npm run build
npx playwright install chromium
npm test
```

The hosted `JavaScript live acceptance harness mechanics` workflow runs these checks on Linux with `playwright install --with-deps chromium`. It has no live keys, secret references, live dispatch, or dashboard mutations. Tests explicitly say **LOCAL FIXTURE ONLY**. They use ephemeral signing keys and loopback HTTP/WebSocket responses to exercise real published packages, causal transitions, context isolation, corrupt storage rejection and fresh processes. This verifies harness mechanics, not live Toggly connectivity, provisioning, or the deployed verifier. `npm run live` never imports the fixture service.

## Prepare isolated live applications

An operator with dashboard permission must provision the application(s), keys and Production environment first. Use a backend key for server rules and a different frontend key for evaluated browser definitions. Nest needs only a backend key; SolidJS needs only a frontend key. SolidStart and SvelteKit need both. The two keys may address independently isolated applications where appropriate; configure the same three flag contracts in each applicable application.

- `new-dashboard`: initially **ON** with AlwaysOn. The operator will turn it OFF then ON when prompted, first for the backend leg and then for the frontend leg. Empty rules means OFF.
- `filter-targeting`: Targeting user `alice`, no default or group rollout. `bob` must be false.
- `ExpressCheckout`: bind context kind `Order`, key `Id`, boolean `Vip`; ContextProperty Vip equals true. Do not add an unconditional bypass. VIP must be true and standard false.
- Expose those three keys to Client SDKs for frontend evaluation. Allow the loopback probe origin according to your isolated application's CORS policy. The probe uses an ephemeral port; configure `LIVE_PORT` to a preauthorized fixed loopback port when an exact origin is required.

Claims are public demonstration inputs: Alice has `staff`/role admin; Bob has no groups/role user. These are not authentication. The runner asserts Targeting and Order isolation; the full eleven-filter customer Sample matrix is outside this probe.

Supply keys only through the existing authorized process environment. This runner creates no `.env` file, key file, management credential storage or browser login. Do not put values in a command line or enable shell tracing. It never changes dashboard flags itself.

| Environment variable | Meaning                                                             |
| -------------------- | ------------------------------------------------------------------- |
| `LIVE_FAMILY`        | `nest`, `solid`, `solidstart`, or `sveltekit`                       |
| `LIVE_BACKEND_KEY`   | Required except for `solid`; server process only                    |
| `LIVE_FRONTEND_KEY`  | Required except for `nest`; intentionally public browser identifier |
| `LIVE_ENVIRONMENT`   | Defaults to `Production`                                            |
| `LIVE_BASE_URL`      | Defaults to `https://definitions.toggly.io`; remote HTTPS only      |
| `LIVE_TIMEOUT_MS`    | Operator transition deadline; defaults to 180000, maximum 600000    |
| `LIVE_PORT`          | Owned localhost asset port; defaults to 0 (ephemeral)               |

Once the environment is populated through the approved mechanism:

```sh
npm run build
npm run live
```

The runner preserves supplied keys/environment. Missing required values fail before launching any browser, subprocess or network operation. It prints only static stage names and operator instructions, never provider exceptions, URL paths, payloads or keys. All external child output is suppressed because SDK diagnostics can contain key-bearing URLs. A nonzero exit is a failed acceptance; inspect the last static stage and provisioning, not secrets in debug dumps.

## What the live run asserts

1. **Backend (Nest/SolidStart/SvelteKit):** real `/definitions-signed/` response with signature metadata, successful SDK initialization/verification, Alice/Bob request isolation, VIP/standard entity decisions. Streaming is enabled and polling disabled. Each prompted OFF/ON requires an actual update frame, a subsequent signed HTTP response and the expected evaluated decision, in that order.
2. **SSR adapter (SolidStart/SvelteKit):** separate evaluated-signed snapshots for Alice/Bob must have SDK `source: signed` provenance and correct targeting. Only the explicit three-key snapshot and public frontend configuration reach the browser. No backend key is serialized.
3. **Backend cold restart:** close the first process; start a second with the same SDK file-cache directory and all fetch calls denied, with streaming disabled. Cached rules still evaluate correctly for both identities and Order entities. This is **trusted parsed-model cache recovery**, not reverification of an original signed envelope. No frontend signed-envelope claim applies to Node core's file cache.
4. **Browser (Solid/SolidStart/SvelteKit):** initialize real signed evaluated definitions, establish a real WebSocket, verify two independent owners' targeting/entity results, then require frame → signed refetch → OFF/ON for both without manual refresh or polling.
5. **Browser cold restart:** close the entire Chromium process and reopen its isolated profile. Supply no SSR seed. Deny all non-owned-origin HTTP requests, including definitions and JWKS, and close all attempted WebSockets before they connect. Only the owned loopback asset server remains reachable. Require persisted SDK envelope/key recovery with a failed network refresh, zero successful refetches and zero socket opens. An uncached identity must not inherit flags; corrupted stored envelopes must fail closed.

The browser probe renders no framework demo UI. Its SSR seed leg is SDK serialization/hydration input acceptance, not a SolidStart/SvelteKit application host test. The backend host is stopped before browser restart; no successful SSR request can conceal a storage failure. This is offline **definitions** recovery; no application service worker or offline customer asset shell is claimed.

Caches and the Chromium profile are isolated temporary directories owned by one invocation and removed after bounded cleanup. Browser SDK storage necessarily contains public targeting data and frontend-key scope; it is not a new secret store. Backend cached models are application-trusted data. Never transfer either cache to production.

## Evidence and remaining gates

Keep install/build/test results separate from a live run. Local tests cannot establish real signing service compatibility or dashboard permissions. Preserve the exact commit and runtime/package versions with each acceptance record, recording only redacted stages and outcomes. No live acceptance has been performed while dashboard provisioning permission remains unavailable. Independent review, exact-head hosted mechanics, real-service execution, and the **actual connected customer Sample UI** leg are distinct gates; none implies the others.
