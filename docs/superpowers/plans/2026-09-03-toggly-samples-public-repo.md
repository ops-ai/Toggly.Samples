# Toggly.Samples Public Repo Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn workspace `Samples/` into the public [ops-ai/Toggly.Samples](https://github.com/ops-ai/Toggly.Samples) catalog with professional docs, community health files, Dependabot, and light CI.

**Architecture:** Catalog monorepo — `Samples/` is the git root; each sample lives in a subdirectory. First sample is `nextjs-server-sdk/`. Match FeatureManagement branding and CloudflareWorker-level GitHub hygiene (not full SDK CI matrix).

**Tech Stack:** Git + GitHub, Markdown, GitHub Actions (Node 22), Dependabot, existing Next.js 15 + Vitest sample.

**Linear:** [OPS-851](https://linear.app/opsai/issue/OPS-851/publish-samples-directory-as-public-ops-aitogglysamples-repo)  
**Design:** `Samples/docs/plans/2026-09-03-toggly-samples-public-repo-design.md`  
**Git root:** `/Users/alexandrupuiu/development/Toggly/Samples`  
**mode:** medium  
**Default branch:** `develop`

---

## File map

| Path | Responsibility |
|------|----------------|
| `README.md` | Branded catalog index |
| `LICENSE` | MIT (opsAI LLC), copy from FeatureManagement |
| `CONTRIBUTING.md` | Samples-focused contribution guide |
| `SECURITY.md` | Private vulnerability reporting for this repo |
| `CODE_OF_CONDUCT.md` | Contributor Covenant (copy from FeatureManagement) |
| `.gitignore` | Root ignores for all samples + OS junk |
| `assets/Github-banner.png` | Banner copied from FeatureManagement |
| `.github/workflows/ci.yml` | Build/test `nextjs-server-sdk` |
| `.github/dependabot.yml` | npm + github-actions weekly |
| `.github/PULL_REQUEST_TEMPLATE.md` | Samples PR checklist |
| `.github/ISSUE_TEMPLATE/*` | Bug, feature, config contact links |
| `nextjs-server-sdk/README.md` | Public polish + keep setup checklist |
| `docs/plans/2026-09-03-*.md` | Approved design (already present) |

**Do not commit:** `.env.local`, `.local-sdk/`, `node_modules/`, `.next/`, `tsconfig.tsbuildinfo`, OS junk.

---

## Chunk 1: Community + catalog docs

### Task 1: Root ignores and assets

**Files:**
- Create: `Samples/.gitignore`
- Create: `Samples/assets/Github-banner.png` (copy)

- [ ] **Step 1:** Create `Samples/.gitignore`:

```gitignore
# Dependencies / build
**/node_modules/
**/.next/
**/out/
**/build/
**/dist/
**/coverage/
**/.turbo/

# Env and local SDK drops
**/.env
**/.env.*
!**/.env.example
**/.local-sdk/

# Tooling / OS
**/.DS_Store
**/*.pem
**/.vercel/
**/tsconfig.tsbuildinfo
**/.pnpm-debug.log*
**/npm-debug.log*
**/yarn-debug.log*
**/yarn-error.log*
```

- [ ] **Step 2:** Copy banner:

```bash
mkdir -p Samples/assets
cp Toggly.FeatureManagement/assets/Github-banner.png Samples/assets/Github-banner.png
```

- [ ] **Step 3:** Confirm `.env.local` and `.local-sdk/` would be ignored (`git check-ignore -v` after init, or dry-run mentally against paths).

---

### Task 2: LICENSE and community health files

**Files:**
- Create: `Samples/LICENSE`
- Create: `Samples/CODE_OF_CONDUCT.md`
- Create: `Samples/SECURITY.md`
- Create: `Samples/CONTRIBUTING.md`

- [ ] **Step 1:** Copy `LICENSE` and `CODE_OF_CONDUCT.md` from `Toggly.FeatureManagement/` (MIT opsAI LLC; Contributor Covenant).
- [ ] **Step 2:** Write `SECURITY.md` pointing at **this** repo’s Security tab:

```markdown
# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

This repository has [GitHub Private Vulnerability Reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) enabled.

1. Go to the [Security tab](https://github.com/ops-ai/Toggly.Samples/security) of this repository.
2. Choose **Report a vulnerability**.
3. Include as much detail as you can: affected sample path, environment, reproduction steps, and impact.

We will acknowledge reports and work with you on a coordinated disclosure when a fix is available.

## Prefer not to use GitHub?

If private reporting is unavailable for your account, contact the maintainers through your existing Toggly support channel and ask to be connected for a security report. Do not include exploit details in public issues, pull requests, or discussions.
```

- [ ] **Step 3:** Write `CONTRIBUTING.md` for samples (open issue first; keep PRs focused on one sample; no secrets; link CoC and SECURITY; point SDK bugs to FeatureManagement).

---

### Task 3: Root README catalog

**Files:**
- Create: `Samples/README.md`

- [ ] **Step 1:** Write FeatureManagement-style root README:

```markdown
<p align="center">
  <img src="assets/Github-banner.png" alt="Toggly">
</p>

<h1 align="center">Toggly Samples</h1>

<p align="center">
  Runnable example apps for <a href="https://toggly.io">Toggly</a> — feature flags, progressive delivery, and experiments across popular frameworks.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://docs.toggly.io"><img src="https://img.shields.io/badge/docs-docs.toggly.io-blue.svg" alt="Documentation"></a>
  <a href="https://toggly.io"><img src="https://img.shields.io/badge/website-toggly.io-0A66C2.svg" alt="Website"></a>
  <a href="https://github.com/ops-ai/Toggly.Samples/security/advisories/new"><img src="https://img.shields.io/badge/security-private%20reporting-red.svg" alt="Security"></a>
</p>

## What's in this repository

Official **sample applications** that show how to integrate Toggly SDKs in real apps. Each folder is a standalone project with its own README and setup steps.

## Get started

1. Create a free app at [toggly.io](https://toggly.io) (Always Free plan available).
2. Pick a sample from the catalog below.
3. Follow that sample's README (env keys, feature flags, and run commands).

SDK install guides live in [docs.toggly.io](https://docs.toggly.io) and in the [SDK monorepo](https://github.com/ops-ai/Toggly.FeatureManagement).

## Samples

| Sample | Stack | Path | What it demos |
|--------|-------|------|---------------|
| Next.js SDK Showcase | Next.js 15 (App Router) | [`nextjs-server-sdk/`](nextjs-server-sdk/) | Server Components, Client hooks, Edge middleware with `@ops-ai/nextjs-toggly-*` |

More samples will be added over time.

## Related

- [Toggly.FeatureManagement](https://github.com/ops-ai/Toggly.FeatureManagement) — official SDKs
- [Documentation](https://docs.toggly.io)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Code of Conduct](CODE_OF_CONDUCT.md)

## License

MIT — see [LICENSE](LICENSE).
```

- [ ] **Step 2:** Visually skim for broken relative links (`assets/`, sample path).

---

### Task 4: Polish Next.js sample README

**Files:**
- Modify: `Samples/nextjs-server-sdk/README.md`

- [ ] **Step 1:** Rewrite the intro to be public-facing (drop OPS-847 from the lead paragraph). Keep the setup, sections table, package versions, behavioral rules, and manual checklist.
- [ ] **Step 2:** Add a **Quick start** block at the top (clone → copy `.env.example` → `npm install` → `npm run dev`).
- [ ] **Step 3:** Keep deep Toggly app setup (Order context, flags) as the following section.

Suggested title/lead:

```markdown
# Next.js SDK Showcase

Runnable Next.js App Router app demonstrating `@ops-ai/nextjs-toggly-server`,
`@ops-ai/nextjs-toggly-client`, and `@ops-ai/nextjs-toggly-edge`.

## Quick start

```bash
cd nextjs-server-sdk
cp .env.example .env.local
# set TOGGLY_APP_KEY and NEXT_PUBLIC_TOGGLY_APP_KEY
npm install
npm run dev
```

Open http://localhost:3000

## Configure your Toggly app
...
```

---

## Chunk 2: GitHub hygiene + CI

### Task 5: Issue / PR templates and Dependabot

**Files:**
- Create: `Samples/.github/PULL_REQUEST_TEMPLATE.md`
- Create: `Samples/.github/ISSUE_TEMPLATE/config.yml`
- Create: `Samples/.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `Samples/.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `Samples/.github/dependabot.yml`

- [ ] **Step 1:** PR template — summary, related issue, which sample, local verify checklist, no-secrets checkbox.
- [ ] **Step 2:** `config.yml` — `blank_issues_enabled: false`; contact links to docs, FeatureManagement discussions, toggly.io, this repo’s security advisories.
- [ ] **Step 3:** Bug template — dropdown of sample paths (`nextjs-server-sdk`, Other); fields for Node/Next version, what happened, expected, repro.
- [ ] **Step 4:** Feature template — sample (or “new sample”), description, motivation.
- [ ] **Step 5:** Dependabot:

```yaml
version: 2

updates:
  - package-ecosystem: npm
    directory: /nextjs-server-sdk
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 5
    labels:
      - dependencies
    groups:
      npm-patch-and-minor:
        applies-to: version-updates
        update-types:
          - minor
          - patch
    ignore:
      - dependency-name: next
        update-types: ["version-update:semver-major"]
      - dependency-name: react
        update-types: ["version-update:semver-major"]
      - dependency-name: react-dom
        update-types: ["version-update:semver-major"]

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 5
    labels:
      - dependencies
```

Do **not** set `target-branch` (default branch is `develop`).

---

### Task 6: CI workflow

**Files:**
- Create: `Samples/.github/workflows/ci.yml`

- [ ] **Step 1:** Add workflow:

```yaml
name: CI

on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  nextjs-server-sdk:
    name: nextjs-server-sdk
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: nextjs-server-sdk
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: nextjs-server-sdk/package-lock.json
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          TOGGLY_APP_KEY: ci-placeholder
          NEXT_PUBLIC_TOGGLY_APP_KEY: ci-placeholder
          TOGGLY_ENVIRONMENT: Production
```

- [ ] **Step 2:** Locally verify CI parity:

```bash
cd Samples/nextjs-server-sdk
npm ci
npm test
TOGGLY_APP_KEY=ci-placeholder NEXT_PUBLIC_TOGGLY_APP_KEY=ci-placeholder npm run build
```

Expected: tests pass; build succeeds (or fix any env/build blockers before push).

---

## Chunk 3: Git mapping and GitHub metadata

### Task 7: Init git, first commit, push

**Files:** n/a (git operations)

- [ ] **Step 1:** Move Linear OPS-851 to **In Progress** (`assignee: me`).
- [ ] **Step 2:**

```bash
cd Samples
git init -b develop
git remote add origin git@github.com:ops-ai/Toggly.Samples.git
git status   # confirm no .env.local / .local-sdk / node_modules
```

- [ ] **Step 3:** Stage professional files + sample source (not ignored junk). Prefer `git add` of explicit paths if status is noisy.
- [ ] **Step 4:** Commit with style from `.cursor/rules/git-commit-style.mdc`:

```bash
git commit -m "$(cat <<'EOF'
Add public Toggly Samples catalog and Next.js showcase [OPS-851]

Initialize the Samples directory as the ops-ai/Toggly.Samples repo with
branded docs, community health files, Dependabot, and CI for the Next.js sample.

Linear Issues:
- OPS-851: Publish Samples directory as public ops-ai/Toggly.Samples repo
EOF
)"
```

- [ ] **Step 5:** Push (user has requested publishing this repo as part of the task):

```bash
git push -u origin develop
```

---

### Task 8: Configure GitHub repo metadata

- [ ] **Step 1:**

```bash
gh repo edit ops-ai/Toggly.Samples \
  --description "Official runnable sample apps for Toggly feature flags and experiments" \
  --homepage "https://toggly.io" \
  --default-branch develop \
  --add-topic feature-flags \
  --add-topic toggly \
  --add-topic samples \
  --add-topic nextjs
```

- [ ] **Step 2:** Enable private vulnerability reporting if not already on:

```bash
gh api -X PATCH repos/ops-ai/Toggly.Samples \
  -f security_and_analysis='{"secret_scanning":{"status":"enabled"}}' 
# or use UI / gh settings for private vulnerability reporting
```

Prefer:

```bash
gh repo edit ops-ai/Toggly.Samples --enable-discussions=false
# Enable private vulnerability reporting via:
gh api repos/ops-ai/Toggly.Samples -q .security_and_analysis
```

If API cannot toggle private reporting, note it for the human in the Linear comment.

- [ ] **Step 3:** Confirm Actions run on the push; open the repo URL and spot-check README rendering.
- [ ] **Step 4:** `save_comment` on OPS-851 with Implementation Summary (files, how to verify). Leave status **In Progress** (or **In Review** only after Oracle pass if claiming ready). Do **not** mark Done unless asked.

---

## Verification checklist

- [ ] https://github.com/ops-ai/Toggly.Samples shows README with banner
- [ ] Default branch is `develop`
- [ ] Cloning and `cd nextjs-server-sdk && npm ci && npm test` works
- [ ] CI green on `develop`
- [ ] No secrets or `.local-sdk` tarballs in the tree (`git ls-files | grep -E 'env.local|local-sdk'` empty)

## Out of scope

Live demo hosting, multi-sample matrix, release automation, submodule from main Toggly repo.
