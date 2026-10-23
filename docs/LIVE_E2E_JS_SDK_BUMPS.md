# Live E2E JavaScript sample SDK bumps (OPS-1992 / OPS-1993 / OPS-1994)

Track intended `@ops-ai/*` version bumps for **react-sdk**, **nuxt-sdk**, and **docusaurus-sdk** after [Toggly.FeatureManagement #828](https://github.com/ops-ai/Toggly.FeatureManagement/pull/828).

| Sample | Package(s) | On `develop` (npm) | Intended bump | Blocker |
|--------|------------|----------------------|---------------|---------|
| react-sdk | `@ops-ai/react-feature-flags-toggly` | 1.14.0 | 1.14.1+ when published | [OPS-1993](https://linear.app/opsai/issue/OPS-1993); fix not in FM #828 merge; [OPS-2007](https://linear.app/opsai/issue/OPS-2007) |
| nuxt-sdk | `@ops-ai/nuxt-toggly-server` | 1.10.0 | 1.10.1+ when published | [OPS-1992](https://linear.app/opsai/issue/OPS-1992); fix not in FM #828 merge; [OPS-2007](https://linear.app/opsai/issue/OPS-2007) |
| docusaurus-sdk | `@ops-ai/toggly-docusaurus-plugin`, `@ops-ai/toggly-client-core` | 0.10.2 / 0.5.2 | 0.10.4 / 0.5.3 | [OPS-1994](https://linear.app/opsai/issue/OPS-1994); FM develop bumped; npm publish pending ([OPS-2007](https://linear.app/opsai/issue/OPS-2007)) |

Samples PR: https://github.com/ops-ai/Toggly.Samples/pull/660

When npm publish completes, bump `package.json` + `package-lock.json` in each sample and remove this table’s “blocked” row.
