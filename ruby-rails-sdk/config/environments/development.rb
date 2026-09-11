Rails.application.configure do
  # Keep the single startup client stable while teaching request-scoped values.
  # Restart after changing Ruby code or environment configuration.
  config.enable_reloading = false
  config.eager_load = false
  config.consider_all_requests_local = true
end
