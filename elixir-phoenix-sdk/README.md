# Elixir / Phoenix SDK showcase

A Phoenix LiveView app with one supervised `Toggly` client, HEEx feature blocks, a Plug route gate, and per-socket identity plus **Order** context.

## Quick start

Requires **Elixir 1.20+** and **Erlang/OTP 29+**.

```sh
cd elixir-phoenix-sdk
cp .env.example .env
mix setup
mix phx.server
```

Open **http://localhost:4000**. Without `TOGGLY_APP_KEY`, a banner explains local demonstration definitions. For live mode, export variables then start the server:

```sh
set -a && source .env && set +a
mix phx.server
```

Use a **backend** SDK key on the server only — never expose it to the browser.

## How it works

**Supervised client** (`lib/showcase/application.ex`):

```elixir
children = [
  {Toggly, [
    name: Showcase.Flags,
    app_key: Application.get_env(:toggly_showcase, :app_key),
    environment: Application.fetch_env!(:toggly_showcase, :environment),
    defaults: %{"new-dashboard" => false, "api-v2" => false, ...},
    signed: not offline
  ]},
  Showcase.Endpoint
]
```

**LiveView mount and context** (`lib/showcase/live.ex`):

```elixir
on_mount({Toggly.LiveView, {Showcase.Flags, @keys}})

socket = Toggly.LiveView.assign_feature_flags(socket, Showcase.Flags, @keys,
  context: Showcase.Context.preset("matching"))
```

**Declarative gate** (HEEx):

```heex
<.feature flags={@toggly_flags} feature="new-dashboard">
  <p>New dashboard enabled</p>
</.feature>
```

**Route gate** (`lib/showcase/router.ex`):

```elixir
pipeline :feature_gate do
  plug(Toggly.Phoenix.Plug, client: Showcase.Flags, gate: "beta-access")
end
```

**Server-side check** at an action boundary:

```elixir
enabled = Toggly.enabled?(Showcase.Flags, "enhanced-submit", socket.assigns.toggly_context)
```

Each LiveView socket keeps its own `toggly_context` (identity, claims, Order). Connected mode refreshes definitions over WebSocket (with polling fallback).

## Workshop sections

| Anchor | Topic |
| --- | --- |
| `#home` | Checklist, presets, snapshot |
| `#declarative` | Feature blocks, all/any, negate |
| `#api` | `enabled?`, usage recording |
| `#identity` | Alice / Bob per tab |
| `#entity` | VIP Order vs standard |
| `#filters` | Shared filter matrix |
| `#phoenix` | Plug gate, refresh, lifecycle |

## Learn more

- [Elixir SDK docs](https://docs.toggly.io/sdks/elixir)
- [Application setup](../docs/APP_SETUP.md)
- [Shared flag template](../docs/FLAG_TEMPLATE.md)
- [Toggly Samples catalog](../README.md#samples)

## For maintainers

`mix test`, `mix format --check-formatted`, and `mix hex.audit` run in CI. Versions: `mix.exs` / `mix.lock`. Optional live acceptance scripts live under `scripts/`.
