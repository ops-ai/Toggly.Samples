Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = true
  config.consider_all_requests_local = false
  config.action_dispatch.show_exceptions = :rescuable
  config.action_controller.allow_forgery_protection = true
  config.secret_key_base = 'public-isolated-test-fixture-' * 4
end
