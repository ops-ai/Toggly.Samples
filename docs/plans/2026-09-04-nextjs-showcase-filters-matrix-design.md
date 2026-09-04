# Next.js Showcase — Latest Packages + Full Filters Matrix

**Date:** 2026-09-04  
**Status:** Approved (human)  
**Sample:** `Samples/nextjs-server-sdk`  
**Toggly app:** Next.js Server SDK Sample (`f7b25291-5511-412d-aeae-7ba5260a7967`)

## Goal

Bring the Next.js SDK Showcase up to date on published npm packages and add a dedicated filters matrix so every supported Toggly filter is exercised, without breaking existing server/client/edge demos.

## Decisions

| Decision | Choice |
|----------|--------|
| Scope | Dedicated flags + showcase pages (option A) |
| Evaluation surface | Server full matrix + thin client UA section (option B) |
| Existing flags | Leave untouched; add new filter-* flags only (option A) |
| Approach | Dedicated filter matrix routes (approach 1) |

## Package bump

| Package | Target |
|---------|--------|
| `@ops-ai/nextjs-toggly-core` | `^1.8.1` |
| `@ops-ai/nextjs-toggly-server` | `^1.5.0` |
| `@ops-ai/nextjs-toggly-client` | `^1.4.0` |
| `@ops-ai/nextjs-toggly-edge` | `^1.2.3` |

Keep `serverExternalPackages: ['ws']`. Do not externalize `@ops-ai/nextjs-toggly-server`.

## New flags

Category `Filters`, tags `["nextjs-showcase","filters"]`. Created via MCP on Production.

| Feature key | Filter | Demo intent |
|-------------|--------|-------------|
| `filter-always-on` | AlwaysOn | Baseline ON |
| `filter-percentage` | Percentage 50% | Sticky by identity |
| `filter-targeting` | Targeting users `alice` @ 100%, default 0% | Identity switcher |
| `filter-user-claims` | UserClaims `role=admin` @ 100% | Claims override |
| `filter-time-window` | TimeWindow open (past → far future) | Always in window |
| `filter-country` | Country `US` @ 100% | Header override (`cf-ipcountry`) |
| `filter-browser-family` | Browser Family `Chrome` @ 100% | UA |
| `filter-browser-language` | Browser Language `en` @ 100% | Accept-Language / UA |
| `filter-device-type` | Device Type `Desktop` @ 100% | UA |
| `filter-os` | Operating System matching catalog (e.g. MacOSX) @ 100% | UA |
| `filter-context-property` | ContextProperty Order `Vip eq true` | Reuse Order mapper |

Exact `parameters` keys follow SDK / MCP conventions (e.g. `Country:0`, Audience.* for Targeting).

## Pages & evaluation UX

### `/server/filters`

- One card/row per filter flag: ON/OFF + short config blurb.
- Controls (cookies / form, aligned with identity switcher):
  - Identity cookie
  - Claims presets (`role=admin` vs `role=user`)
  - Header overrides: country, User-Agent, Accept-Language
  - Order Vip toggle for context-property
- Evaluate with `isServerFeatureOn(key, { identity, claims, groups, headers, context })` — never mutate process-wide `client.identity`.

### `/client/filters`

- Subset: browser-family, browser-language, device-type, os (+ AlwaysOn control).
- Local `TogglyProvider` with `evaluationMode: 'local'` for UA-based local eval.
- Hooks show live results; server page remains authoritative for Country / Targeting / Claims / Time / Percentage / Context.

### Nav / docs

- Link from `/`, `/server`, `/client`, and README checklist.

## Testing

**Automated:** helpers unit-tested; `npm test`; `npm run build`.

**Manual:** WS connected; each flag matching vs non-matching context; client UA cases; regression of existing README checklist.

## Out of scope

- Changing behavior of existing demo flags
- Edge middleware for filter flags
- Publishing new SDK versions (consume published only)
