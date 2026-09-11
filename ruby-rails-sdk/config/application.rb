require_relative 'boot'
require 'rails'
require 'action_controller/railtie'
require 'action_view/railtie'
require 'rails/test_unit/railtie'
require 'propshaft'
require 'toggly-rails'

module RubyRailsSdkSample
  class Application < Rails::Application
    config.load_defaults 8.1
    # This server-rendered showcase has no database, jobs, mail or storage service.
    config.hosts = ['localhost', '127.0.0.1']
    config.session_store :cookie_store, key: '_ruby_rails_sdk_sample', same_site: :lax
    config.action_controller.forgery_protection_origin_check = true
    config.assets.paths << root.join('app/assets/stylesheets')
    config.assets.paths << root.join('app/assets/javascripts')
    config.cache_store = :file_store, ENV.fetch('TOGGLY_CACHE_PATH', root.join('tmp/cache').to_s)
  end
end
