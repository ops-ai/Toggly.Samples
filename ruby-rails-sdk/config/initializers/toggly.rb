require 'digest'
require 'uri'
require_relative '../../app/services/catalog'
require_relative '../../app/models/order'
require_relative '../../app/services/request_context'

key = ENV.fetch('TOGGLY_APP_KEY', '').strip
period = Integer(ENV.fetch('TOGGLY_REFRESH_INTERVAL', '10'))
raise ArgumentError, 'Refresh interval must be 1–3600 seconds' unless (1..3600).cover?(period)
fixture = ENV['TOGGLY_LOCAL_FIXTURE'] == 'true'
url = ENV['TOGGLY_DEFINITIONS_URL']
if fixture
  uri = URI(url.to_s)
  unless uri.scheme == 'http' && %w[127.0.0.1 localhost].include?(uri.host)
    raise ArgumentError, 'Fixture definitions must use loopback HTTP'
  end
end

Rails.application.config.x.toggly_mode = key.empty? ? 'offline' : (fixture ? 'fixture' : 'connected')
namespace = Digest::SHA256.hexdigest("#{key}:#{ENV.fetch('TOGGLY_ENVIRONMENT', 'Production')}")[0, 20]

# Configure once at boot. Reconfiguration replaces the process client without
# closing its predecessor. Request handlers only supply their own contexts.
Toggly::Rails.configure do |config|
  config.app_key = key.empty? ? nil : key
  config.environment = ENV.fetch('TOGGLY_ENVIRONMENT', 'Production')
  config.defaults = Catalog::DEFAULTS
  config.refresh_interval = period
  config.http_timeout = 3
  config.enable_undefined_in_dev = false
  config.definitions_url = url unless url.to_s.empty?
  # Native Rails.cache snapshots persist definitions, never per-user decisions.
  # Missing-key mode deliberately uses only defaults, not an old snapshot.
  config.use_rails_cache = !key.empty?
  config.cache_key_prefix = "rails-sdk-sample:#{namespace}"
  config.context_builder = ->(request, state) { RequestContext.build(state, request) }
end
# The published Railtie installs middleware/helpers and owns at_exit close.
