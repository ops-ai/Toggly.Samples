Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = true
  config.consider_all_requests_local = false
  config.public_file_server.enabled = true
  config.log_level = :info
  # This example binds loopback HTTP. A deployed site must add TLS and secure
  # cookies; do not expose this unauthenticated teaching app on a public host.
end
