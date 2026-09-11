# Next.js SDK Showcase

Runnable Next.js App Router app demonstrating `@ops-ai/nextjs-toggly-server`,
`@ops-ai/nextjs-toggly-client`, and `@ops-ai/nextjs-toggly-edge`.

## Quick start

```bash
cd nextjs-server-sdk
cp .env.example .env.local
# set TOGGLY_APP_KEY and NEXT_PUBLIC_TOGGLY_APP_KEY from app.toggly.io
npm install
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
6. Optionally set `TOGGLY_ENVIRONMENT` (default `Production`).

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

## Behavioral rules

- **No FeatureOff** — use `<Feature featureKey negate>`.
- **Per-call identity** — `getRequestIdentity()` reads the `toggly-identity`
  cookie and passes `identity` into helpers / props. Process-wide
  `client.identity` is not mutated from the request.
- **Client hydration** — client layout may pass `initialFeatures` from
  `getServerToggly()?.state.features` into `TogglyProvider` (optional SSR
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
