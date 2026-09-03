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

1. In [app.toggly.io](https://app.toggly.io), use application **Next.js Server SDK Sample** (or create one).
2. Ensure context kind **Order** exists with properties:
   - `Id` (string, key)
   - `Vip` (boolean)
   - `Total` (number, optional)
3. Feature flags:
   - `new-dashboard` (boolean) — server components / client demos
   - `api-v2` (boolean) — `/api/data` + multi-key gates
   - `enhanced-submit` (boolean) — Server Actions
   - `ExpressCheckout` with context kind **Order** and Context Property filter:
     - Property `Vip`, operator `eq`, value `true`
   - `beta-access` (boolean) — **required for Edge** middleware on `/edge/beta`
4. Copy `.env.example` to `.env.local` and set:
   - `TOGGLY_APP_KEY` (server + edge)
   - `NEXT_PUBLIC_TOGGLY_APP_KEY` (same key for client demos)
5. Optionally set `TOGGLY_ENVIRONMENT` (default `Production`).

## Sections

| Path | Package | What it demos |
|------|---------|---------------|
| `/` | — | Map + flag checklist + snapshot |
| `/server/*` | `@ops-ai/nextjs-toggly-server` | Feature/negate/variant, programmatic, actions, cache, identity, orders, API |
| `/client/*` | `@ops-ai/nextjs-toggly-client` | TogglyProvider, hooks, client components |
| `/edge/*` | `@ops-ai/nextjs-toggly-edge` | Path middleware (`beta-access` → waitlist) |

Legacy paths (`/dashboard`, `/actions`, `/api-demo`, `/orders`) redirect under `/server/*`.

## Package versions

Published npm packages:

- `@ops-ai/nextjs-toggly-core` `^1.7.0`
- `@ops-ai/nextjs-toggly-server` `^1.3.0`
- `@ops-ai/nextjs-toggly-client` `^1.2.0`
- `@ops-ai/nextjs-toggly-edge` `^1.2.2`

`next.config.ts` sets `serverExternalPackages: ['ws']` so Turbopack does not
rewrite the WebSocket client. Do **not** externalize `@ops-ai/nextjs-toggly-server`
itself (its `next/cache` import only resolves inside the Next bundler).

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

### Client

- [ ] Without `NEXT_PUBLIC_TOGGLY_APP_KEY`, client section shows muted banner (no crash)
- [ ] `/client/hooks` — each hook shows loading then state; live update after flag flip
- [ ] `/client/components` — Feature / FeatureGate / FeatureSwitch / FeatureVariant

### Edge

- [ ] Create `beta-access` if missing
- [ ] `beta-access` ON → `/edge/beta` renders
- [ ] `beta-access` OFF → `/edge/beta` redirects to `/edge/waitlist`
- [ ] `/edge`, `/edge/waitlist`, `/edge/unavailable` remain reachable
