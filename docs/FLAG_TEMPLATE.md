# Flag + app template

## Create application

1. Sign in at [app.toggly.io](https://app.toggly.io). Use a workspace you can
   manage (the one created at signup is enough). You do not need a workspace
   named Toggly Samples.
2. Name: **{Stack} SDK Sample** (for example, **Remix SDK Sample**)
3. Technology: select the matching stack in the picker.
4. Environment: **Production** (default).
5. Allowed Web Origins: add the local sample URL or URLs, such as
   `http://localhost:3000`.

## Context kind: Order

| Property | Type | Notes |
|----------|------|-------|
| `Id` | string | Key |
| `Vip` | boolean | Used by the Express Checkout example |
| `Total` | number | Optional |

## Demo flags

| Key | Configuration and use |
|-----|-----------------------|
| `new-dashboard` | Baseline application/environment toggle with no filter required; switch it on and off for declarative and programmatic demos |
| `api-v2` | Baseline application/environment toggle with no filter required; switch it on and off for API and multi-key gates |
| `enhanced-submit` | Baseline application/environment toggle with no filter required; switch it on and off for actions and mutations |
| `ExpressCheckout` | ContextProperty rule: `Order.Vip = true`; evaluate with `ord-vip` and `ord-standard` |
| `beta-access` | Baseline application/environment toggle with no filter required; switch it on and off for middleware, edge, and gate routes |

## Filters category

Create a **Filters** category and these flags:

| Key | Filter configuration |
|-----|----------------------|
| `filter-always-on` | AlwaysOn |
| `filter-percentage` | Percentage, 50% sticky rollout by identity |
| `filter-targeting` | Targeting, users = `alice` |
| `filter-user-claims` | UserClaims, `role` = `admin` |
| `filter-time-window` | TimeWindow, open from 2020 through 2099 |
| `filter-country` | Country = `US` |
| `filter-browser-family` | BrowserFamily = Chrome |
| `filter-browser-language` | BrowserLanguage includes `en` |
| `filter-device-type` | DeviceType = Macintosh |
| `filter-os` | OperatingSystem = Mac |
| `filter-context-property` | ContextProperty, `Order.Vip` = `true` |

Configure the flags so the following presets exercise the matrix. These values
match the reference controls in
[`nextjs-server-sdk/components/filter-context-controls.tsx`](../nextjs-server-sdk/components/filter-context-controls.tsx)
and the filter definitions in
[`nextjs-server-sdk/lib/filter-catalog.ts`](../nextjs-server-sdk/lib/filter-catalog.ts).

| Input | Matching preset | Non-matching preset |
|-------|-----------------|---------------------|
| Identity | `alice` | `bob` |
| Claims | `role=admin` | `role=user` |
| Country / `cf-ipcountry` | `US` | `CA` |
| Accept-Language | `en-US,en;q=0.9` | `fr-FR,fr;q=0.9` |
| User-Agent | Chrome 120 on macOS 10.15.7 | Firefox 121 on Windows 10 |
| Order | `ord-vip` with `Vip=true` | `ord-standard` with `Vip=false` |

Use these exact User-Agent values when a sample offers reusable presets:

```text
Matching: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Non-matching: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0
```

`filter-always-on` remains on for both presets. `filter-time-window` remains on
while the configured window is open. `filter-percentage` is sticky for an
identity, so its result is not prescribed as matching or non-matching.

After applying the Matching preset, expect targeting, claims, country, browser,
language, device, operating-system, and context-property flags to be on. After
applying the Non-matching preset, expect those flags to be off. If an SDK cannot
evaluate one of these filters, identify that gap in the sample README rather
than reporting a false result.

## Environment files

Commit `.env.example` only. Never commit real app keys. Node samples should use
the reference names where applicable:

```dotenv
TOGGLY_APP_KEY=
NEXT_PUBLIC_TOGGLY_APP_KEY=
TOGGLY_ENVIRONMENT=Production
```

Replace the public key name with the framework-specific public environment
variable when the stack requires one.
