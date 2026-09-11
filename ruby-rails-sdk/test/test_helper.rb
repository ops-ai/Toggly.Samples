ENV['RAILS_ENV'] = 'test'
require 'tmpdir'
require_relative 'support/fixture_server'
FIXTURE = FixtureServer.new
TEST_CACHE = Dir.mktmpdir('rails-sdk-native-test')
ENV['TOGGLY_APP_KEY'] = 'local-fixture'
ENV['TOGGLY_LOCAL_FIXTURE'] = 'true'
ENV['TOGGLY_DEFINITIONS_URL'] = FIXTURE.url
ENV['TOGGLY_CACHE_PATH'] = TEST_CACHE
# Avoid poll races inside deterministic unit/integration assertions.
ENV['TOGGLY_REFRESH_INTERVAL'] = '3600'
at_exit do
  FIXTURE.close
  FileUtils.remove_entry(TEST_CACHE)
end
require_relative '../config/environment'
require 'rails/test_help'
require 'json'

class ActiveSupport::TestCase
  setup do
    FIXTURE.reset
    Toggly.client.refresh(force: true)
  end
end
