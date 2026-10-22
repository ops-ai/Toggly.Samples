# Angular SDK workshop

A single-page Angular app that loads Toggly feature definitions in the browser, renders native `<feature>` / `*featureFlag` gates, guards a route, and evaluates flags for a signed-in user plus an **Order** entity.

## Quick start

Requires **Node 22+**.

```sh
cd angular-sdk
npm ci
cp .env.example .env.local
# Optional: set TOGGLY_APP_KEY (public browser key). Leave empty for offline fixtures.
npm start
```

Open **http://localhost:4200**. Without a key, a banner explains offline mode and the app uses bundled demonstration definitions. With a key, the SDK fetches signed definitions from Toggly; restart after changing `.env.local`.

## How it works

**Register the SDK** in application config (`provideToggly`):

```ts
// src/app/app.config.ts
import { provideToggly } from "@ops-ai/ngx-feature-flags-toggly";
import { togglyOptions } from "./sample/config";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideToggly(togglyOptions()),
  ],
};
```

**Declarative gates** in templates (`src/app/sections/native-gates.html`):

```html
<feature featureKey="new-dashboard">
  <ng-template featureTemplate>
    <p>Native component: new dashboard</p>
  </ng-template>
</feature>
<p *featureFlag="'new-dashboard'; negate: true">Existing dashboard visible</p>
```

**Route guard** (`src/app/app.routes.ts`):

```ts
{
  path: "beta",
  component: Beta,
  canActivate: [featureFlagGuard],
  data: { featureFlag: "beta-access", featureFlagRedirect: "/" },
}
```

**User + Order context** (`src/app/sample/workshop.ts`):

```ts
this.sdk.registerContext<Order>("Order", (o) => ({
  kind: "Order",
  key: o.Id,
  attributes: { Vip: o.Vip, Total: o.Total },
}));
// …
await this.sdk.isFeatureOn(key, order, "Order");
```

Identity presets call `setContext` on the service. Order changes update the registered entity passed into `isFeatureOn` without replacing the signed-in user. Flags are for UI rollout, not authorization.

**Variants note:** the Variants section uses a second service with `enableVariants: true`. Entity-gated flags and variant assignment do not share one snapshot today — see [OPS-1736](https://linear.app/opsai/issue/OPS-1736).

## Workshop sections

| Section | What to try |
| --- | --- |
| Home | Toggle `new-dashboard`, live checklist |
| Declarative gates | Component, directive, all/any, negate |
| Programmatic API | `isFeatureOn`, enhanced submit |
| Identity | Alice / Bob presets |
| Entity | VIP vs standard Order |
| Filters | Matching / non-matching matrix |
| Variants | `*featureVariant`, `getVariant` |
| Angular surfaces | Route guard, local device gate, telemetry |

## Learn more

- [Angular SDK guide](https://docs.toggly.io/sdks/javascript/angular)
- [Shared flag template](../docs/FLAG_TEMPLATE.md)
- [Toggly Samples catalog](../README.md#samples)

## For maintainers

`npm test` runs unit and Playwright browser tests with offline fixtures. Package versions live in `package.json` / `package-lock.json`. See [Sample Contract](../docs/SAMPLE_CONTRACT.md).
