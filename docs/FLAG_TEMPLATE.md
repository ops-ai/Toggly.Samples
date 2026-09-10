# Flag + app template (Toggly Samples workspace)

Use this shared configuration with the [application setup guide](APP_SETUP.md).
The guide covers the actual technology labels, Conditions editor, and management
API fallback when a filter type is absent from the picker. A sample's README
supplies its exact application name, local URLs, and SDK-specific parameter forms.

## Create application

1. Workspace: **Toggly Samples**
2. Name: **{Stack} SDK Sample** (for example, **Remix SDK Sample**)
3. Technology: select the matching stack using the
   [picker labels](APP_SETUP.md#choose-the-application-and-technology).
4. Environment: **Production**. Create/select it if workspace defaults differ.
5. Application URL: use the sample's local URL. For client-side apps, add its
   exact local origins under **Allowed Web Origins**, such as
   `http://localhost:3000`. Server-only apps do not show that CORS section; see
   [local URLs and origins](APP_SETUP.md#local-urls-and-origins).

## Context kind: Order

| Property | Type | Notes |
|----------|------|-------|
| `Id` | string | Key |
| `Vip` | boolean | Used by the Express Checkout example |
| `Total` | number | Optional |

Create these properties in **Contexts → New Context** and select `Id` as the
key property. Optional `Total` means the sample may omit it from entity data;
the context editor has no per-property optional checkbox. Bind both
`ExpressCheckout` and `filter-context-property` to **Order** in their feature
**Context** field before adding their conditions.

## Demo flags

| Key | Configuration and use |
|-----|-----------------------|
| `new-dashboard` | Baseline application/environment toggle; switch it on and off for declarative and programmatic demos |
| `api-v2` | Baseline application/environment toggle; switch it on and off for API and multi-key gates |
| `enhanced-submit` | Baseline application/environment toggle; switch it on and off for actions and mutations |
| `ExpressCheckout` | ContextProperty rule: `Order.Vip = true`; evaluate with `ord-vip` and `ord-standard` |
| `beta-access` | Baseline application/environment toggle; switch it on and off for middleware, edge, and gate routes |

The dashboard stores an enabled baseline as **AlwaysOn** and a disabled baseline
as an empty rule list. No targeting condition is needed for these four toggles.

## Filters category

Create a **Filters** category and these flags:

| Key | Filter configuration |
|-----|----------------------|
| `filter-always-on` | AlwaysOn |
| `filter-percentage` | Percentage, 50% sticky rollout by identity |
| `filter-targeting` | Targeting, users = `alice`; no groups or default rollout |
| `filter-user-claims` | UserClaims, `role` = `admin`; segment Percentage = 100 |
| `filter-time-window` | TimeWindow, `2020-01-01T00:00:00Z` through `2099-12-31T23:59:59Z` |
| `filter-country` | Country = `US`; segment Percentage = 100 |
| `filter-browser-family` | BrowserFamily = Chrome; segment Percentage = 100 |
| `filter-browser-language` | BrowserLanguage includes `en`; segment Percentage = 100 |
| `filter-device-type` | DeviceType = Macintosh; segment Percentage = 100 |
| `filter-os` | OperatingSystem = Mac; segment Percentage = 100 |
| `filter-context-property` | ContextProperty, `Order.Vip` = `true` |

These rows describe the shared evaluation behavior, not a universal JSON dialect.
Use each sample's verified native names and parameters. Set segment Percentage
to **100** explicitly; it is separate from the **50** percent rollout on
`filter-percentage`. Each filter flag has its one intended rule: remove any
extra **AlwaysOn** row when configuring a restrictive or Order condition.

For Java, Python, Laravel, WordPress, Ruby on Rails, and Rust, the source-defined
picker omits **Percentage**, **Targeting**, and **TimeWindow**. Creating custom
filter metadata does not add them to this selector. Use the
[single-feature management API procedure](APP_SETUP.md#when-a-filter-is-missing-from-the-picker)
with the sample's verified native parameter form; keep the correct technology.

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

The SDK app key configures the running sample; it is not management API
authorization. Follow the [setup verification steps](APP_SETUP.md#verify-the-applied-configuration)
after creating the application and rules. Local sample tests do not prove that
your live application, origins, context, or flags have been provisioned.
