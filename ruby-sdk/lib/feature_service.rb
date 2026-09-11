# frozen_string_literal: true

require 'toggly'
require 'time'
require_relative 'configuration'
require_relative 'local_telemetry'

module RubyShowcase
  class FeatureService
    attr_reader :client, :configuration, :telemetry

    def initialize(configuration, snapshot_provider: nil, telemetry: LocalTelemetry.new)
      @configuration = configuration
      @telemetry = telemetry
      options = configuration.options.merge(usage_client: telemetry, metrics_client: telemetry)
      unless configuration.mode == 'offline'
        options[:snapshot_provider] = snapshot_provider || Toggly::SnapshotProviders::File.new(path: configuration.snapshot_path)
      end
      # Construction fetches once before the app begins serving. Context belongs
      # to local evaluations, not to this process-wide definitions fetch.
      @client = Toggly::Client.new(options)
    end

    def snapshot(context)
      Catalog::FLAGS.map do |key|
        # Pair fields from one native result so refresh cannot mix revisions
        # within a row. Separate rows may still observe different revisions.
        # Actual gates use enabled? for defaults and automatic usage checks;
        # this diagnostic view does neither and does not allocate variants.
        result = @client.evaluate(key, context: context)
        { key: key, enabled: result.enabled, reason: result.reason }
      end
    end

    def close
      @client.close unless @client.closed?
    end
  end
end
