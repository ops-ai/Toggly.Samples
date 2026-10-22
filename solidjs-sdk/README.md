# SolidJS SDK workshop

A client-only SolidJS app with a `TogglyProvider`, reactive `Feature` gates, programmatic checks, identity presets, and **Order**-scoped evaluation.

## Quick start

Requires **Node 22+**.

```sh
cd solidjs-sdk
npm ci
cp .env.example .env
# Optional: VITE_TOGGLY_APP_KEY (public browser key). Empty = offline defaults.
npm run dev
```

Open **http://localhost:5173**. Without a key, a banner appears and documented defaults apply; remote targeting and Order rules need a configured Toggly application. Restart the dev server after editing `.env`.

## How it works

**Provider setup** (`src/App.tsx`):

```tsx
<TogglyProvider config={{
  appKey: import.meta.env.VITE_TOGGLY_APP_KEY || undefined,
  environment: import.meta.env.VITE_TOGGLY_ENVIRONMENT || "Production",
  flagDefaults: defaults,
}}>
  <Workshop configured={Boolean(config.appKey)} />
</TogglyProvider>
```

**Declarative gate**:

```tsx
<Feature feature="new-dashboard">
  <p>New dashboard</p>
</Feature>
<Feature feature="new-dashboard" negate>
  <p>Classic dashboard</p>
</Feature>
```

**Programmatic check**:

```tsx
const dashboard = useFeatureFlag("new-dashboard");
toggly.evaluate(["new-dashboard"]);
```

**Identity and Order** (`src/App.tsx`):

```tsx
await toggly.client.setContext(preset);
const checkout = useFeatureFlag("ExpressCheckout", () => order(vip()));
```

The SDK has no dashboard **experiment** enrollment API; use boolean gates or ordinary UI branching — [OPS-2003](https://linear.app/opsai/issue/OPS-2003).

After a successful online refresh, verified definitions can be restored from `localStorage` for the same targeting; failed refreshes keep the last verified snapshot visible.

## Workshop sections

| # | Section | Focus |
| --- | --- | --- |
| 1 | Home | Checklist, refresh, first toggle |
| 2 | Declarative gates | Feature, negate, all/any |
| 3 | Programmatic API | Evaluate, telemetry actions |
| 4 | Identity | Matching / non-matching presets |
| 5 | Entity context | Order `Vip` |
| 6 | Filters matrix | Shared filter keys |
| 7 | Solid ownership | Signals, resource, local gate |
| 8 | Configuration | Missing-key banner |

## Learn more

- [SolidJS SDK guide](https://docs.toggly.io/sdks/javascript/solid)
- [Shared flag template](../docs/FLAG_TEMPLATE.md)
- [Toggly Samples catalog](../README.md#samples)

## For maintainers

`npm test` and `npm run build` use offline fixtures. Dependencies: `package.json` / `package-lock.json`.
