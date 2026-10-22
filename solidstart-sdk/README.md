# SolidStart SDK workshop

A SolidStart app that evaluates flags on the **server**, hydrates a browser `TogglyProvider` from a signed public snapshot, and independently guards a POST handler with the backend client.

## Quick start

Requires **Node 24+**.

```sh
cd solidstart-sdk
npm ci
cp .env.example .env
npm run dev
```

Open **http://localhost:5173**. Empty keys show configuration banners and safe defaults. Set keys in `.env` and rebuild when changing any `VITE_` variable.

| Variable                 | Role                                         |
| ------------------------ | -------------------------------------------- |
| `VITE_TOGGLY_APP_KEY`    | Public frontend key (SSR snapshot + browser) |
| `TOGGLY_BACKEND_APP_KEY` | Private server key for `/api/submit`         |
| `TOGGLY_ENVIRONMENT`     | Backend environment (default Production)     |

Never put the backend key or secrets in a `VITE_` variable.

## How it works

**Server client and per-request scope** (`src/lib/flags.server.ts`):

```ts
const backend = createTogglyClient({
  appKey: process.env.TOGGLY_BACKEND_APP_KEY,
  environment: process.env.TOGGLY_ENVIRONMENT ?? 'Production',
  featureDefaults: defaults,
});
const scope = createTogglyRequest({
  client: backend,
  request,
  context: principal,
  frontend: { appKey: process.env.VITE_TOGGLY_APP_KEY, expose: keys, flagDefaults: defaults },
});
const snapshot = await scope.snapshot();
```

**Guarded server route** (`src/routes/api/submit.ts`):

```ts
await scope.requireFeature('enhanced-submit');
return Response.json({ message: 'Enhanced submit branch ran on the server.' });
```

**Browser gates** (same package as SolidJS — `Feature`, `useFeatureFlag` in `src/routes/index.tsx`).

Identity presets are teaching data, not authentication. Boolean gates only — no experiment enrollment API ([OPS-2003](https://linear.app/opsai/issue/OPS-2003)).

## Workshop sections

| Section               | Focus                                |
| --------------------- | ------------------------------------ |
| Home                  | Server snapshot + live browser flags |
| Declarative gates     | Feature, negate, lazy panel          |
| Programmatic API      | Accessor + real POST guard           |
| Identity              | Alice / Bob via server query         |
| Entity context        | Order `Vip` checkbox                 |
| Filters matrix        | Shared filter keys                   |
| SolidStart boundaries | Server-only imports, disposal        |
| Configuration         | Missing frontend/backend banners     |

## Learn more

- [SolidStart SDK guide](https://docs.toggly.io/sdks/javascript/solidstart)
- [SolidJS SDK guide](https://docs.toggly.io/sdks/javascript/solid) (shared browser API)
- [Shared flag template](../docs/FLAG_TEMPLATE.md)
- [Toggly Samples catalog](../README.md#samples)

## For maintainers

`npm test`, `npm run typecheck`, and `npm run build` validate the sample. Dependencies: `package.json` / `package-lock.json`.
