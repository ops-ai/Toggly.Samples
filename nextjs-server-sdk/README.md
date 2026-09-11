# Next.js SDK Showcase

Runnable Next.js App Router app demonstrating `@ops-ai/nextjs-toggly-server`,
`@ops-ai/nextjs-toggly-client`, and `@ops-ai/nextjs-toggly-edge`.

## Try your first toggle

A **feature flag** is a named decision that lets deployed code choose an enabled
or disabled path. Its **key** is the exact string in code (`new-dashboard`);
its **definition** contains the rules configured in Toggly. An **environment**
selects a separate set of definitions within an application. **Evaluation** is
applying those rules to inputs such as a user identity or an Order.

1. Follow Quick start below, using Node.js 22 and an App Key from your Toggly
   application. A blank key lets you inspect setup pages but does not load flags.
2. In that application's selected environment (initially `Production`), create
   `new-dashboard` as a global toggle, initially disabled. Start with this one
   flag; you can provision the remaining examples afterward.
3. Visit `/server/dashboard`: expect the OFF/negate branch. Enable the flag in
   Toggly, allow definitions to update, and refresh the page to see the ON branch.
   The application code has not changed; the evaluated decision has.
4. Visit `/client/hooks` with the public App Key configured. Observe loading,
   enabled state, and the error field. Flip the flag back. Browser subscriptions
   can update the page without a full navigation; server-rendered pages need a
   fresh render. There is no guaranteed five-second delivery bound.
5. If results disagree, check the exact key, application, and both environment
   settings first, then `/api/toggly-debug`. A successful build or fixture test
   does not establish a connection to your dashboard.

**Edge limitation in the published package:** this sample uses edge `1.2.3`,
whose middleware reads `x-toggly-identity` or `toggly-identity` from requests,
assigns it to a shared client, and can reuse a cached boolean snapshot across
identities. The sample's identity switcher writes that same cookie, so visiting
`/edge/beta` after using it reaches this behavior even though middleware config
contains no explicit identity. Use a global `beta-access` toggle for the demo.
Do not copy this middleware into concurrent per-user targeting or authorization;
request isolation needs an SDK/runtime follow-up. This teaching change preserves
that behavior and does not fix it.

## Quick start

```bash
cd nextjs-server-sdk
cp .env.example .env.local
# set TOGGLY_APP_KEY and NEXT_PUBLIC_TOGGLY_APP_KEY from app.toggly.io
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configure your Toggly app

1. In [app.toggly.io](https://app.toggly.io), create a dedicated application named **Next.js Server SDK Sample** in a workspace you can manage (the one from signup is enough).
2. Ensure context kind **Order** exists with properties:
   - `Id` (string, key)
   - `Vip` (boolean)
   - `Total` (number, optional)
3. Feature flags (demos):
   - `new-dashboard` — server components / client demos
   - `api-v2` — `/api/data` + multi-key gates
   - `enhanced-submit` — Server Actions
   - `ExpressCheckout` — Order Vip Context Property
   - `beta-access` — Edge middleware on `/edge/beta`
4. Filter matrix flags (`Filters` category) — one per filter type:
   - `filter-always-on`, `filter-percentage`, `filter-targeting`,
     `filter-user-claims`, `filter-time-window`, `filter-country`,
     `filter-browser-family`, `filter-browser-language`, `filter-device-type`,
     `filter-os`, `filter-context-property`
5. Copy `.env.example` to `.env.local` and set:
   - `TOGGLY_APP_KEY` (server + edge)
   - `NEXT_PUBLIC_TOGGLY_APP_KEY` (same key for client demos)
6. Optionally set `TOGGLY_ENVIRONMENT` (default `Production`). For a different
   environment, also set `NEXT_PUBLIC_TOGGLY_ENVIRONMENT` to the same value.

`NEXT_PUBLIC_` is Next.js's browser-exposure prefix: direct references are
inlined into the JavaScript bundle at build time. Restart development after
changing these values; rebuild production assets to change their public values.
The provider source tries `NEXT_PUBLIC_TOGGLY_ENVIRONMENT`, then
`TOGGLY_ENVIRONMENT`, then `Production`, but the server-only variable is normally
unavailable in the browser. Setting only the server variable is insufficient.
Use only a public application key here, never a management token or secret.
`TOGGLY_APP_KEY` is read by server/edge code and does not substitute for the
separate public App Key.

## Read the source in this order

| Start here | What to trace |
|------------|---------------|
| [`lib/env.ts`](lib/env.ts), [`lib/toggly.ts`](lib/toggly.ts), [`app/layout.tsx`](app/layout.tsx) | Application/environment selection, awaited initialization, shared definitions and mapper registration |
| [`app/(server)/server/dashboard/page.tsx`](app/%28server%29/server/dashboard/page.tsx), [`components/page.tsx`](app/%28server%29/server/components/page.tsx) | One decision as a method call, JSX gate, negate, all/any and enabled/disabled branches |
| [`lib/identity.ts`](lib/identity.ts), [`components/identity-switcher.tsx`](components/identity-switcher.tsx) | Cookie → per-request identity → per-call check |
| [`lib/orders.ts`](lib/orders.ts), [`lib/order-context.ts`](lib/order-context.ts), [`orders/[id]/page.tsx`](app/%28server%29/server/orders/%5Bid%5D/page.tsx) | Domain fixture → named context attributes → matching and missing-context checks |
| [`lib/filter-eval-options.ts`](lib/filter-eval-options.ts), [`components/filter-context-controls.tsx`](components/filter-context-controls.tsx) | Editable presets → cookies → evaluation inputs, without changing definitions |
| [`app/actions.ts`](app/actions.ts), [`app/api/data/route.ts`](app/api/data/route.ts) | Check again when an action or API request executes |
| [`components/providers.tsx`](components/providers.tsx), [`client/layout.tsx`](app/%28client%29/client/layout.tsx), [`hooks/page.tsx`](app/%28client%29/client/hooks/page.tsx) | Initial snapshot → browser initialization → loading and updates |
| [`middleware.ts`](middleware.ts), [`server/cache/page.tsx`](app/%28server%29/server/cache/page.tsx) | Edge path decisions and a separate Next.js result cache |

## Sections

| Path | Package | What it demos |
|------|---------|---------------|
| `/` | — | Map + flag checklist + snapshot |
| `/server/*` | `@ops-ai/nextjs-toggly-server` | Feature/negate/variant, programmatic, actions, cache, identity, orders, API, **filters matrix** |
| `/client/*` | `@ops-ai/nextjs-toggly-client` | TogglyProvider, hooks, components; `/client/filters` uses request UA via server eval |
| `/edge/*` | `@ops-ai/nextjs-toggly-edge` | Path middleware (`beta-access` → waitlist) |

Legacy paths (`/dashboard`, `/actions`, `/api-demo`, `/orders`) redirect under `/server/*`.

## Package versions

Published npm packages:

- `@ops-ai/nextjs-toggly-core` `^1.8.1`
- `@ops-ai/nextjs-toggly-server` `^1.5.0`
- `@ops-ai/nextjs-toggly-client` `^1.4.0`
- `@ops-ai/nextjs-toggly-edge` `^1.2.3`

`next.config.ts` sets `serverExternalPackages: ['ws']` so Turbopack does not
rewrite the WebSocket client. Do **not** externalize `@ops-ai/nextjs-toggly-server`
itself (its `next/cache` import only resolves inside the Next bundler).

## Filters matrix

- **`/server/filters`** — all `filter-*` flags via per-call
  `isServerFeatureOn` with controllable identity, claims, country, UA,
  Accept-Language, and Order Vip cookies.
- **`/client/filters`** — AlwaysOn + browser/language/device/OS evaluated with
  this browser’s request `User-Agent` / `Accept-Language` (server local eval;
  browser `evaluationMode: 'local'` needs CORS on `definitions-signed`).

Use **Matching preset** / **Non-matching preset** on the server page, then
Apply & refresh.

## What a result means

The server package loads full definitions and evaluates them locally with each
call's inputs. The client provider defaults to remote evaluated booleans; the
published edge package also fetches evaluated booleans. `/client/filters` is a
Server Component despite its URL: it evaluates using the incoming browser's
headers. It does not prove browser-local filter execution or CORS availability.

This sample supplies no explicit `featureDefaults` to the server or edge. Unknown
keys normally evaluate false. The browser provider seeds defaults from
`initialFeatures`; these are startup booleans, not rule definitions. A fetched
result replaces the starting decision. Refresh failures may retain previously
loaded results, so OFF is not a diagnostic for every network error and an ON
result does not prove a fresh fetch. Inspect the error field and refresh time.
With no App Key, most pages show configuration guidance, `/api/data` returns 503,
and the sample middleware bypasses its gate. These are deliberate setup paths.

Server WebSocket updates refresh definitions; rendering a Server Component again
is a separate step. `/server/cache` additionally uses Next.js `unstable_cache`
with `revalidate: 60` and tags, so it can lag uncached checks. Edge caching defaults
to 60 seconds and does not use the Node client's WebSocket. Browser hooks expose
loading/readiness separately from a boolean result; readiness alone does not
prove that a fetch succeeded.

`FeatureVariant` selects enabled or disabled markup. `FeatureSwitch` selects
on/off/loading markup. Neither creates experiment cohorts or records conversion
metrics. `all` requires every key, `any` requires at least one, and `negate`
inverts the combined result: "not all" does not mean "all off".

## Identity and Order walkthrough

The server switcher writes a session cookie; each server request reads it and
passes its value into individual checks. The shared process can serve many users,
so request handling never assigns that cookie to the Node client's identity.
The SDK can generate a process identity during initialization. The snapshot
labels it as the SDK default, distinct from the cookie. No override means SDK
process defaults, not necessarily an anonymous empty string.

The browser `useIdentity` demo changes its own provider's identity; it does not
synchronize the server cookie. In these published versions, a failed remote
identity refresh is not rolled back transactionally. Neither identity entry nor
the editable `role=admin` claim authenticates anyone. Production code must derive
trusted claims from its authentication system and enforce authorization on the
server independently of presentation flags. See the edge limitation above before
assuming the Node sample's isolation applies to middleware.

For `ExpressCheckout`, configure ContextProperty `Order.Vip == true` using the
[shared flag template](../docs/FLAG_TEMPLATE.md). `mapOrderToContext` turns an
Order's `id`, `vip`, and `total` into its key and `Vip`/`Total` attributes. The
mapper is registered once; each evaluation supplies its own Order and `Order`
kind. The VIP fixture matches; standard and high-value fixtures do not. A high
`Total` does not imply `Vip`. The detail page removes context or uses `Unknown`
to show that this configured rule cannot match without the appropriate entity.
These fixtures supply business data, not replacement flag definitions.

On `/server/filters`, presets change the form; **Apply & refresh** sends their
cookie inputs into a new evaluation. Matching uses alice/admin/US/Chrome Mac/en
and a VIP order. Non-matching changes those inputs. AlwaysOn and the open time
window stay ON under either preset; a sticky percentage rule is not guaranteed
ON for every matching identity. Configure rules from the shared template before
interpreting the matrix. Client browser rows instead use actual request headers.

## Behavioral rules

- **No FeatureOff** — use `<Feature featureKey negate>`.
- **Per-call identity** — `getRequestIdentity()` reads the `toggly-identity`
  cookie and passes `identity` into helpers / props. Process-wide
  `client.identity` is not mutated from the request.
- **Client hydration** — client layout passes `initialFeatures` from
  `getFeatures()` when a server client is available into `TogglyProvider` (optional SSR
  hydration, not server evaluation of client gates).

Debug: `GET /api/toggly-debug` (optional `?refresh=1`).

## Manual checklist

### Shared

- [ ] Missing `TOGGLY_APP_KEY` shows banner on every page
- [ ] `/` lists sections + flag checklist; identity cookie Set/Clear updates snapshot without setting `client.identity`
- [ ] `git status` shows `.env.local` untracked / ignored

### Server

- [ ] `/server/components` — Feature / negate / FeatureVariant / multi-key / entity flip with `new-dashboard`, `api-v2`, VIP order
- [ ] `/server/programmatic` — useServerToggly / getServerToggly / isServerFeatureOn agree
- [ ] `/server/actions` — checkFeature, withFeature, checkFeatureGate flip with `enhanced-submit` (+ `api-v2` for gate)
- [ ] `/server/cache` — values labeled cached; may lag live WS until revalidate
- [ ] `/server/identity` — side-by-side with/without cookie identity
- [ ] `/server/dashboard` — Feature / negate for `new-dashboard`
- [ ] `/server/api-demo` → `GET /api/data` version 1 ↔ 2 with `api-v2`
- [ ] `/server/orders`: `ord-vip` ExpressCheckout ON; standard / high-value OFF
- [ ] `/server/orders/ord-vip`: entity ON; no entity OFF; kind `Unknown` OFF
- [ ] `/server/filters` Matching preset → AlwaysOn, Targeting (alice), Claims, Country US, Chrome/en/Desktop/Mac, TimeWindow, Context Vip ON; Percentage sticky for identity
- [ ] `/server/filters` Non-matching preset → Targeting/Claims/Country/UA/Vip OFF (AlwaysOn + TimeWindow still ON)

### Client

- [ ] Without `NEXT_PUBLIC_TOGGLY_APP_KEY`, client section shows muted banner (no crash)
- [ ] `/client/hooks` — each hook shows loading then state; live update after flag flip
- [ ] `/client/components` — Feature / FeatureGate / FeatureSwitch / FeatureVariant
- [ ] `/client/filters` — AlwaysOn ON; Chrome desktop Mac → browser/device/os ON (uses request UA)

### Edge

- [ ] Create `beta-access` if missing
- [ ] `beta-access` ON → `/edge/beta` renders
- [ ] `beta-access` OFF → `/edge/beta` redirects to `/edge/waitlist`
- [ ] `/edge`, `/edge/waitlist`, `/edge/unavailable` remain reachable
