# Rust Axum SDK workshop

A server-rendered Axum app that builds a `TogglyClient` at startup, evaluates flags per request with full **EvalContext** (user, claims, HTTP segments, Order), and demonstrates native Axum extractors and layers.

## Quick start

Requires **Rust 1.98+** (see `rust-toolchain.toml`).

```sh
cd rust-axum-sdk
cargo test --locked
cargo run --locked
```

Open **http://localhost:8017**. Export `TOGGLY_APP_KEY` (and optional `TOGGLY_ENVIRONMENT`) in your shell to connect your Toggly application. Empty or placeholder keys select bundled offline fixtures. The app does not read `.env` files.

## How it works

**Client at startup** (`src/lib.rs`):

```rust
let client = TogglyClient::new(config).await.ok().map(Arc::new);
// Extension<Arc<TogglyClient>> shared across routes
```

**Evaluate with request context** (`src/routes.rs`):

```rust
client.is_enabled(key, &context.evaluation).await
```

**Native `Feature` extractor** (header identity only — `X-User-Id` then `X-Identity`):

```rust
pub async fn native(feature: Feature) -> Json<Value> {
    let enabled = feature.is_enabled("beta-access").await;
    // …
}
```

**Sample route denial** (full workshop context — cookie, claims, Order):

```rust
let result = decision(client, "beta-access", &context.evaluation).await;
if !result.enabled { return Err(StatusCode::NOT_FOUND); }
```

Register the **Order** schema before building the client (`context::register_order()`). Demo personas are not authentication.

**SDK gap:** `DeviceType=Macintosh` stays false for the shared Chrome/macOS User-Agent preset; use `OperatingSystem=Mac` or see [OPS-2004](https://linear.app/opsai/issue/OPS-2004).

## Workshop sections

| Path | Topic |
| --- | --- |
| `/home` | Checklist, offline banner |
| `/declarative` | Template gates, all/any |
| `/programmatic` | JSON check API |
| `/identity` | Cookie persona, claims |
| `/orders` | Order key, `Vip`, `Total` |
| `/filters` | Eleven shared filter rows |
| `/surfaces` | Feature extractor, layer, state |
| `/setup` | App key, Toggly application recipe |

## Learn more

- [Rust SDK docs](https://docs.toggly.io/sdks/rust)
- [Application setup](../docs/APP_SETUP.md)
- [Shared flag template](../docs/FLAG_TEMPLATE.md)
- [Toggly Samples catalog](../README.md#samples)

## For maintainers

`cargo fmt --check`, `cargo test --locked`, `cargo clippy --locked`, and `python3 scripts/http_smoke.py` mirror CI. Crate pins: `Cargo.toml` / `Cargo.lock`.
