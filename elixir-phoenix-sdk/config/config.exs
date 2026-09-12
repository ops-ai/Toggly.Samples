import Config

config :toggly_showcase, Showcase.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [formats: [html: Showcase.ErrorHTML], layout: false],
  pubsub_server: Showcase.PubSub,
  live_view: [signing_salt: "toggly-showcase-live"]

config :phoenix, :json_library, Jason
