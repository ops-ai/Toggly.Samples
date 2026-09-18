# frozen_string_literal: true

require 'uri'
require 'digest'
require_relative 'catalog'

module RubyShowcase
  class Configuration
    attr_reader :mode, :environment, :refresh_interval, :snapshot_path, :options

    def initialize(env = ENV)
      key = env.fetch('TOGGLY_APP_KEY', '').strip
      key = '' if key == 'ci-placeholder'
      @environment = env.fetch('TOGGLY_ENVIRONMENT', 'Production')
      @refresh_interval = Integer(env.fetch('TOGGLY_REFRESH_INTERVAL', '10'))
      raise ArgumentError, 'Refresh interval must be between 1 and 3600 seconds' unless (1..3600).cover?(@refresh_interval)

      fixture = env['TOGGLY_LOCAL_FIXTURE'] == 'true'
      @mode = key.empty? ? 'offline' : (fixture ? 'fixture' : 'connected')
      url = env['TOGGLY_DEFINITIONS_URL']
      if fixture
        uri = URI(url.to_s)
        unless uri.scheme == 'http' && %w[127.0.0.1 localhost ::1].include?(uri.host)
          raise ArgumentError, 'Local fixture mode requires a loopback HTTP definitions URL'
        end
      end

      # Isolate persisted definitions by application/environment without writing the key.
      namespace = Digest::SHA256.hexdigest("#{key}:#{@environment}")[0, 20]
      @snapshot_path = env.fetch('TOGGLY_SNAPSHOT_PATH', File.expand_path("../tmp/#{namespace}.json", __dir__))
      connected = @mode == 'connected'
      fixture = @mode == 'fixture'
      @options = {
        app_key: key.empty? ? nil : key,
        environment: @environment,
        defaults: Catalog::DEFAULTS,
        enable_undefined_in_dev: false,
        refresh_interval: @refresh_interval,
        http_timeout: 3,
        enable_live_updates: false,
        disable_entity_context_registration: true,
        enable_usage_tracking: connected || fixture,
        enable_metrics: connected || fixture
      }
      unless connected
        # Fixture/offline capture stays local. Live mode uses the SDK default (~60s).
        @options[:usage_flush_interval] = 0
        @options[:metrics_flush_interval] = 0
      end
      @options[:definitions_url] = url unless url.to_s.empty?
    end
  end
end
