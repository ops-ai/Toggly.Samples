# Rust Rocket SDK workshop

A server-rendered Rocket app with a managed `TogglyClient`, per-request evaluation, native `Feature` route guards, and the same shared flag catalog as the other Rust samples.

## Quick start

Requires **Rust 1.98+** (see `rust-toolchain.toml`).

```sh
cd rust-rocket-sdk
cargo test --locked
cargo run --locked
```

Open **http://localhost:8016**. Export `TOGGLY_APP_KEY` in your shell for live definitions; placeholder values use offline fixtures. The app does not load dotenv files.

## How it works

**Managed client** (see `src/lib.rs` — one `TogglyClient` in Rocket state, closed on shutdown).

**Evaluate with context** (`src/routes.rs`):

```rust
client.is_enabled(key, &context.evaluation).await
```

**Native guard** (untrusted headers only on `/native`):

```rust
#[get("/native?<feature..>")]
fn native(feature: Feature<'_>) -> Json<Value> { /* … */ }
```

**Composed beta route** (full workshop context):

```rust
let result = decision(client, "beta-access", &context.evaluation).await;
if !result.enabled { return Err(StatusCode::NotFound); }
```

Order registration and matching/non-matching presets match the Axum sample. `DeviceType=Macintosh` is false for the shared desktop Chrome UA — [OPS-2004](https://linear.app/opsai/issue/OPS-2004).

## Workshop sections

| Path | Topic |
| --- | --- |
| `/home` | Snapshot, presets |
| `/declarative` | Gates and negate |
| `/programmatic` | API checks |
| `/identity` | Session persona |
| `/orders` | Entity context |
| `/filters` | Filter matrix |
| `/surfaces` | Feature guard, fairing |
| `/setup` | Configuration help |

## Learn more

- [Rust SDK docs](https://docs.toggly.io/sdks/rust)
- [Application setup](../docs/APP_SETUP.md)
- [Shared flag template](../docs/FLAG_TEMPLATE.md)
- [Toggly Samples catalog](../README.md#samples)

## For maintainers

Same verification commands as `rust-axum-sdk`. Dependencies: `Cargo.toml` / `Cargo.lock`.
