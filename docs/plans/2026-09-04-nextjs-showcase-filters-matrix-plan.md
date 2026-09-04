# Next.js Showcase Filters Matrix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bump Next.js showcase packages to latest npm and add `/server/filters` + `/client/filters` that exercise every supported Toggly filter via dedicated flags.

**Architecture:** Leave existing demo flags alone. Create `filter-*` flags in the production Toggly app. Server page evaluates with per-call `FeatureCheckOptions` (identity, claims, headers, entity). Client filters subtree uses `evaluationMode: 'local'` for UA-driven filters. Shared catalog constants + cookie helpers keep controls consistent.

**Tech Stack:** Next.js 15 App Router, `@ops-ai/nextjs-toggly-{core,server,client,edge}`, Vitest, Toggly MCP for flag provisioning.

**Linear:** [OPS-896](https://linear.app/opsai/issue/OPS-896/nextjs-showcase-latest-packages-full-filters-matrix)

**Design:** `Samples/docs/plans/2026-09-04-nextjs-showcase-filters-matrix-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `nextjs-server-sdk/package.json` | Pin latest `@ops-ai/nextjs-toggly-*` |
| `nextjs-server-sdk/lib/filter-catalog.ts` | Flag keys, blurb, which surface (server/client) |
| `nextjs-server-sdk/lib/filter-eval-cookies.ts` | Cookie names + parse helpers for claims/headers/vip |
| `nextjs-server-sdk/lib/filter-eval-options.ts` | Build `FeatureCheckOptions` from cookies + Order fixture |
| `nextjs-server-sdk/components/filter-context-controls.tsx` | Client form to set filter-demo cookies |
| `nextjs-server-sdk/app/(server)/server/filters/page.tsx` | Server matrix |
| `nextjs-server-sdk/app/(client)/client/filters/page.tsx` | Request-UA subset (server eval; CORS blocks browser local) |
| `nextjs-server-sdk/tests/filter-eval-options.test.ts` | Unit tests for options builder |
| `nextjs-server-sdk/README.md`, home/server/client indexes | Docs + nav links |

---

### Task 1: Linear + package bump

**Files:**
- Modify: `nextjs-server-sdk/package.json`
- Modify: `nextjs-server-sdk/README.md` (versions section)

- [ ] **Step 1: Ensure Linear issue exists** (opsAI / Toggly / Feature / assignee me / In Progress)

- [ ] **Step 2: Bump dependencies**

```json
"@ops-ai/nextjs-toggly-client": "^1.4.0",
"@ops-ai/nextjs-toggly-core": "^1.8.1",
"@ops-ai/nextjs-toggly-edge": "^1.2.3",
"@ops-ai/nextjs-toggly-server": "^1.5.0"
```

- [ ] **Step 3: Install and verify**

```bash
cd Samples/nextjs-server-sdk
rm -rf node_modules/.local-sdk 2>/dev/null; npm install
node -p "JSON.parse(require('fs').readFileSync('node_modules/@ops-ai/nextjs-toggly-core/package.json')).version"
# expect 1.8.1 (or latest matching range)
npm test
```

- [ ] **Step 4: Commit**

```bash
git add nextjs-server-sdk/package.json nextjs-server-sdk/package-lock.json nextjs-server-sdk/README.md
git commit -m "$(cat <<'EOF'
Bump Next.js showcase Toggly packages to latest [OPS-896]

Align the showcase with published core 1.8.x / server 1.5.x /
client 1.4.x / edge 1.2.3 for local-eval and per-call filters.

Linear Issues:
- OPS-896: Next.js showcase: latest packages + full filters matrix
EOF
)"
```

---

### Task 2: Provision filter flags in Toggly

**App ID:** `f7b25291-5511-412d-aeae-7ba5260a7967`  
**Environment:** Production  

Use MCP `create_feature` + `update_feature_configuration` (`action: setFilters`).

Suggested filter JSON shapes (adjust if API rejects — inspect `get_application_details` Supported Filters):

| Key | setFilters payload (conceptual) |
|-----|----------------------------------|
| `filter-always-on` | `[{"name":"AlwaysOn","parameters":{}}]` or `action: enable` |
| `filter-percentage` | `[{"name":"Percentage","parameters":{"Value":"50"}}]` |
| `filter-targeting` | Targeting with `Audience.Users:0` = `alice`, `Audience.DefaultRolloutPercentage` = `0` |
| `filter-user-claims` | `[{"name":"UserClaims","parameters":{"Claim":"role","Value":"admin","Percentage":"100"}}]` |
| `filter-time-window` | Start `2020-01-01T00:00:00Z`, End `2099-01-01T00:00:00Z` |
| `filter-country` | `Country:0` = `US`, `Percentage` = `100` |
| `filter-browser-family` | Browser Families include Chrome, Percentage 100 |
| `filter-browser-language` | Languages include `en`, Percentage 100 |
| `filter-device-type` | Device Types Desktop, Percentage 100 |
| `filter-os` | OS MacOSX (or catalog value), Percentage 100 |
| `filter-context-property` | `contextKind: Order`, ContextProperty Vip eq true |

- [ ] **Step 1: Create each feature** with category `Filters`, tags `["nextjs-showcase","filters"]`. For context-property set `contextKind: Order`, `contextRequirementType: All`.

- [ ] **Step 2: Apply Production filters** via `setFilters` / enable.

- [ ] **Step 3: Verify** with `get_application_details` — all eleven keys present with expected filter types.

- [ ] **Step 4: Commit nothing** (Toggly cloud only). Note keys in README in a later task.

---

### Task 3: Filter catalog + eval helpers (TDD)

**Files:**
- Create: `nextjs-server-sdk/lib/filter-catalog.ts`
- Create: `nextjs-server-sdk/lib/filter-eval-cookies.ts`
- Create: `nextjs-server-sdk/lib/filter-eval-options.ts`
- Create: `nextjs-server-sdk/tests/filter-eval-options.test.ts`
- Reuse: `lib/order-context.ts`, `lib/identity.ts`, order fixtures from orders demo

- [ ] **Step 1: Write failing tests** for building options from cookie bag:

```ts
// tests/filter-eval-options.test.ts
it('maps country cookie to cf-ipcountry header', () => {
  const opts = buildFilterEvalOptions({
    identity: 'alice',
    country: 'US',
    claimsPreset: 'admin',
    vip: true,
  })
  expect(opts.identity).toBe('alice')
  expect(opts.claims).toEqual({ role: 'admin' })
  expect(opts.headers?.['cf-ipcountry']).toBe('US')
  expect(opts.context).toMatchObject({ Vip: true })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- tests/filter-eval-options.test.ts
```

- [ ] **Step 3: Implement catalog + cookie constants + `buildFilterEvalOptions`**

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
Add filter catalog and eval options helpers [OPS-896]

Centralize filter showcase flag keys and map demo cookies into
per-call FeatureCheckOptions for the server filters page.

Linear Issues:
- OPS-896: Next.js showcase: latest packages + full filters matrix
EOF
)"
```

---

### Task 4: Server filters page + controls

**Files:**
- Create: `nextjs-server-sdk/components/filter-context-controls.tsx`
- Create: `nextjs-server-sdk/app/(server)/server/filters/page.tsx`
- Modify: `app/(server)/server/page.tsx`, `app/page.tsx`

- [ ] **Step 1: Implement cookie-setting client controls** (identity reuse or link IdentitySwitcher; claims preset; country; UA; Accept-Language; Vip). On submit set cookies + `router.refresh()`.

- [ ] **Step 2: Implement `/server/filters` page**

```tsx
await initSampleToggly()
const options = await readFilterEvalOptionsFromCookies()
for (const entry of FILTER_CATALOG) {
  const on = await isServerFeatureOn(entry.key, options)
  // render card
}
```

- [ ] **Step 3: Wire nav links** on home + server index.

- [ ] **Step 4: Manual smoke** — `npm run dev`, open `/server/filters`, toggle country US/CA and alice identity.

- [ ] **Step 5: Commit**

---

### Task 5: Client filters page (request UA)

**Files:**
- Create: `nextjs-server-sdk/app/(client)/client/filters/page.tsx`
- Modify: `app/(client)/client/page.tsx`

- [x] **Step 1: Server page** reads `headers()` and evaluates CLIENT_FILTER_KEYS
  with `isServerFeatureOn(..., { headers })`. (Nested local `TogglyProvider`
  blocked by missing CORS on `definitions-signed` from localhost.)

- [x] **Step 2: Show** AlwaysOn + browser-family/language/device/os.

- [x] **Step 3: Link from `/client` index.**

- [x] **Step 4: Smoke** — Chrome Mac UA → all expected ON.

- [ ] **Step 5: Commit**

---

### Task 6: README + thorough checklist + thorough test

**Files:**
- Modify: `nextjs-server-sdk/README.md`

- [ ] **Step 1: Document** new flags, `/server/filters`, `/client/filters`, cookie controls, package versions.

- [ ] **Step 2: Extend manual checklist** with matching/non-matching cases from the design.

- [ ] **Step 3: Run full verification**

```bash
npm test
npm run build
# Manual: design testing section — all filters + existing demos regression
```

- [ ] **Step 4: Commit README**

- [ ] **Step 5: Linear comment** with implementation summary + test notes (do not mark Done unless asked).

---

## Done when

- [ ] Packages resolve to latest within ranges
- [ ] Eleven filter flags live in Production with correct filter types
- [ ] `/server/filters` and `/client/filters` work as designed
- [ ] Unit tests + build pass; manual matrix + regression checklist completed
