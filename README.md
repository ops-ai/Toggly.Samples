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
| Vue SDK Workshop | Vue 3 + Vite | [`vue-sdk/`](vue-sdk/) | Native Feature/composables, user and Order context, variants, local gates, signed responses and offline exercises |
| Next.js SDK Showcase | Next.js 15 (App Router) | [`nextjs-server-sdk/`](nextjs-server-sdk/) | Server Components, Client hooks, and Edge middleware with `@ops-ai/nextjs-toggly-*` |
| Fastify SDK Showcase | Fastify 5 | [`nodejs-fastify-sdk/`](nodejs-fastify-sdk/) | Request-scoped plugin context, native gates, Order and filter matrix with `@ops-ai/toggly-fastify` |
| Angular SDK Workshop | Angular 22 standalone | [`angular-sdk/`](angular-sdk/) | Native templates, directives, variants, route guard, local gates and Order context |
| Ruby Rails SDK Sample | Rails 8.1 / Ruby 4 | [`ruby-rails-sdk/`](ruby-rails-sdk/) | Native Railtie and view/controller gates, request contexts, Orders, filter matrix and cache snapshots |
| PHP Laravel SDK Sample | PHP 8.5 + Laravel 13 | [`php-laravel-sdk/`](php-laravel-sdk/) | Native Blade, middleware, attributes, request identity, variants, filter matrix and explicit Order support limits |
| JavaScript SDK Sample | Vanilla TypeScript + Vite | [`javascript-sdk/`](javascript-sdk/) | Browser flags, variants, session identity, entity context, and live refresh with `@ops-ai/feature-flags-toggly` |
| Node Express SDK Sample | Express 5 | [`nodejs-express-sdk/`](nodejs-express-sdk/) | Request middleware, HTTP gates, identities, Order context and filter matrix |
| Node Hono SDK Showcase | Hono 4 / Node 22 | [`nodejs-hono-sdk/`](nodejs-hono-sdk/) | Request context, middleware gates, eleven filters and Order entities with `@ops-ai/toggly-hono` |
| Docusaurus SDK Workshop | Docusaurus 3 + React | [`docusaurus-sdk/`](docusaurus-sdk/) | Native MDX/React flags, core Order mapping, live snapshots and build/browser boundaries |

New to feature flags? Start with a sample's **first-toggle exercise**, then its
source-reading map. Follow configuration → initialization → one flag check →
enabled/disabled branches before adding identity, Order context and filters.
The JavaScript sample gives a browser-focused introduction; Next.js compares
server and browser execution; Fastify shows request evaluation without a UI SDK.
Sample fixtures and placeholder-key checks are not evidence of live Toggly app
provisioning. Use each README's configuration recipe for your own application.

## Wave 1 availability

The catalog above links samples present on `develop`. The following work has a
separate status; previews and blocked checkpoints are not merged runnable entries.

| Sample | Status | Details |
|--------|--------|---------|
| React | [Blocked: OPS-1083](https://linear.app/opsai/issue/OPS-1083) | SDK 1.11.0 bundles a private React 18.3.1; provider/hooks fail with the required latest-stable host React 19.2.8. |
| Koa | [Blocked: OPS-1087](https://linear.app/opsai/issue/OPS-1087) | Adapter 0.3.0 declares Koa ^2, excluding required latest-stable Koa 3.2.1; dependency resolution fails. |
| Remix | [Blocked: OPS-1088](https://linear.app/opsai/issue/OPS-1088) | Client 1.3.0 requires React/ReactDOM ^18 and @remix-run/react ^2, incompatible with the sample's current React Router 8.3.1 / React 19.2.8 target. |
| Nuxt | [Blocked: OPS-1089](https://linear.app/opsai/issue/OPS-1089) | Module 1.1.1 declares Nuxt ^3, excluding required latest-stable Nuxt 4.5.2; dependency resolution fails. |

Compatibility status was checked on September 8, 2026. These blockers concern
the programme's latest-stable framework constraint; they do not imply the SDKs
are universally unusable with older supported versions. Blocked samples are not
linked to nonexistent folders. Linear detail links may require authentication.

All new samples follow the [Sample Contract](docs/SAMPLE_CONTRACT.md) and the
shared [flag and app template](docs/FLAG_TEMPLATE.md). Follow the
[application setup guide](docs/APP_SETUP.md) for dashboard controls and the
management API procedure when a filter type is missing from the picker.

## Related

- [Toggly.FeatureManagement](https://github.com/ops-ai/Toggly.FeatureManagement) — official SDKs
- [Documentation](https://docs.toggly.io)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Code of Conduct](CODE_OF_CONDUCT.md)

## License

MIT — see [LICENSE](LICENSE).
