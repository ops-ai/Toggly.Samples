# frozen_string_literal: true

module RubyShowcase
  # The SDK performs real aggregation. This bounded public transport records only
  # batch counts for teaching, without sending identities or metrics to a service.
  class LocalTelemetry
    def initialize
      @mutex = Mutex.new
      @counts = { usage_batches: 0, metric_batches: 0, closed: false }
    end

    def send_stats(_payload)
      @mutex.synchronize { @counts[:usage_batches] += 1 }
    end

    def send_metrics(_payload)
      @mutex.synchronize { @counts[:metric_batches] += 1 }
    end

    def close
      @mutex.synchronize { @counts[:closed] = true }
    end

    def summary
      @mutex.synchronize { @counts.dup }
    end
  end
end
