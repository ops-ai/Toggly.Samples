# Toggly.Samples public repo design

**Linear:** [OPS-851](https://linear.app/opsai/issue/OPS-851/publish-samples-directory-as-public-ops-aitogglysamples-repo)  
**Date:** 2026-09-03  
**Status:** Approved

## Goal

Map the workspace `Samples/` directory to the empty public GitHub repository
[ops-ai/Toggly.Samples](https://github.com/ops-ai/Toggly.Samples) and ship a
professional samples catalog (docs, community health, light CI).

## Decisions

| Topic | Choice |
|-------|--------|
| Git mapping | Init git inside `Samples/`; `origin` → `ops-ai/Toggly.Samples` (same as FeatureManagement / CloudflareWorker) |
| Default branch | `develop` |
| Layout | Catalog monorepo: each sample in its own folder; do not flatten Next.js to repo root |
| Branding | FeatureManagement-style root README (centered banner + badges) |
| Scope | Community files + Dependabot + CI build/test + issue/PR templates |
| First sample | `nextjs-server-sdk/` (published `@ops-ai/nextjs-toggly-*` packages) |

## Architecture

```
Samples/                          ← git root
├── README.md                     ← branded catalog index
├── LICENSE                       ← MIT (opsAI LLC)
├── CONTRIBUTING.md
├── SECURITY.md
├── CODE_OF_CONDUCT.md
├── .gitignore
├── assets/Github-banner.png
├── .github/
│   ├── dependabot.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── ISSUE_TEMPLATE/
│   └── workflows/ci.yml
├── docs/plans/                   ← this design (+ future plans)
└── nextjs-server-sdk/            ← showcase app
```

## Docs tone

- **Root README:** visitor-facing index — pitch, get-started, catalog table, links to SDKs/docs.
- **Sample README:** keep flag matrix + checklist; lead with quick start; soften/remove internal ticket refs from the intro.
- **Community files:** adapted from FeatureManagement for a samples audience (no publishable-package checklist).

## CI and Dependabot

- **CI:** Node 22; `working-directory: nextjs-server-sdk`; `npm ci` → `npm test` → `npm run build` on push/PR to `develop`.
- No live Toggly credentials in CI; Vitest stays offline; build must not require secrets.
- **Dependabot:** npm for `/nextjs-server-sdk`, GitHub Actions at root; weekly; PRs to default branch (`develop`). Do not set `target-branch` (keeps security updates enabled).

## Publish sequence

1. Add professional files and polish sample README.
2. `git init`, first commit on `develop`, push `-u origin develop`.
3. Configure GitHub: default branch `develop`, description, homepage `https://toggly.io`, topics (`feature-flags`, `toggly`, `samples`, `nextjs`).
4. Verify Actions; leave Linear In Progress / In Review per Oracle rules — do not mark Done unless asked.

## Out of scope (v1)

- Live hosted demo
- Multi-sample CI matrix
- Release automation
- Submodule / subtree link from the main Toggly SaaS repo

## Risks

- Accidental commit of `.env.local` or `.local-sdk/` — mitigate with root + sample `.gitignore`.
- Next.js `build` failing without env — verify locally before push; use empty placeholders only if required and safe.
