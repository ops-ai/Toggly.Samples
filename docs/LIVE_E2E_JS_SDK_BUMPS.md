# Live E2E JavaScript sample SDK bumps (OPS-1992 / OPS-1993 / OPS-1994)

Track intended `@ops-ai/*` version bumps for **react-sdk**, **nuxt-sdk**, and **docusaurus-sdk** on [Samples PR #660](https://github.com/ops-ai/Toggly.Samples/pull/660).

**Rule:** bump **one sample at a time**, only after **that row’s FM fix has merged** and **that row’s target version is published on npm**. Completing [OPS-2006](https://linear.app/opsai/issue/OPS-2006) (Docusaurus / Client Core publish) does **not** unblock React or Nuxt — those fixes were **not** in [FM #828](https://github.com/ops-ai/Toggly.FeatureManagement/pull/828). Until publish, samples stay on the published versions in each `package.json` (no pinning unpublished versions; CI `ETARGET` otherwise).

## Per-package gates

| Sample | Package(s) | On npm today (samples `develop`) | Bump to (after gate) | FM fix | Wait for |
|--------|------------|----------------------------------|----------------------|--------|----------|
| **react-sdk** | `@ops-ai/react-feature-flags-toggly` | 1.14.0 | **1.14.1** | [OPS-1993](https://linear.app/opsai/issue/OPS-1993) (`enableVariants` entity-gated definitions) — **not** in FM #828 | FM fix merged **and** `@ops-ai/react-feature-flags-toggly@1.14.1` on npm |
| **nuxt-sdk** | `@ops-ai/nuxt-toggly-server` | 1.10.0 | **1.10.2** | [OPS-1992](https://linear.app/opsai/issue/OPS-1992) (`useEventToggly` + `configureEventEvalContext`) — **not** in FM #828 | FM fix merged **and** `@ops-ai/nuxt-toggly-server@1.10.2` on npm |
| **docusaurus-sdk** | `@ops-ai/toggly-docusaurus-plugin`, `@ops-ai/toggly-client-core` | 0.10.2 / 0.5.2 | **0.10.4** / **0.5.3** | [OPS-1994](https://linear.app/opsai/issue/OPS-1994) (SDK definition fetch headers) — in FM #828 | [OPS-2006](https://linear.app/opsai/issue/OPS-2006) JS gate + npm publish of **0.10.4** and **0.5.3** ([FM#829](https://github.com/ops-ai/Toggly.FeatureManagement/pull/829)) |

## When to edit each sample

### React — OPS-1993 only

1. FM merges the OPS-1993 fix and releases **`@ops-ai/react-feature-flags-toggly@1.14.1`** to npm.
2. Bump **only** `react-sdk` `package.json` + `package-lock.json` to **1.14.1**.
3. Do **not** bump react-sdk when only Docusaurus packages publish.

### Nuxt — OPS-1992 only

1. FM merges the OPS-1992 fix and releases **`@ops-ai/nuxt-toggly-server@1.10.2`** to npm.
2. Bump **only** `nuxt-sdk` `package.json` + `package-lock.json` to **1.10.2**.
3. Do **not** bump nuxt-sdk when only Docusaurus packages publish.

### Docusaurus — OPS-1994 + OPS-2006 only

1. FM develop already carries OPS-1994 version bumps from #828; npm publish is gated on [OPS-2006](https://linear.app/opsai/issue/OPS-2006).
2. After **`@ops-ai/toggly-docusaurus-plugin@0.10.4`** and **`@ops-ai/toggly-client-core@0.5.3`** are on npm, bump **only** `docusaurus-sdk` manifests and lockfile.
3. Plugin **0.10.3** is intentionally skipped; target **0.10.4** per FM develop.

## After a row clears

Update or remove that row from this doc in the same PR that applies the version bump.
