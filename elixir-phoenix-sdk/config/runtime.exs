import Config
key = System.get_env("TOGGLY_APP_KEY")
secret = System.get_env("SECRET_KEY_BASE")

secret =
  if secret in [nil, ""] do
    if config_env() == :prod, do: raise("Set SECRET_KEY_BASE for production")
    Base.encode64(:crypto.strong_rand_bytes(64))
  else
    secret
  end

config :toggly_showcase, Showcase.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.get_env("PORT", "4000"))],
  secret_key_base: secret,
  server: config_env() != :test

config :toggly_showcase,
  app_key: key,
  environment: System.get_env("TOGGLY_ENVIRONMENT", "Production"),
  offline: key in [nil, ""]
