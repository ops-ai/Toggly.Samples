# frozen_string_literal: true

require 'puma'
require 'json'

# Deterministic loopback HTTP definitions, consumed by the real published SDK.
# No evaluator is replaced. Control stays in the test process, not an HTTP API.
class FixtureServer
  attr_reader :url

  def initialize
    @mutex = Mutex.new
    @definitions = JSON.parse(File.read(File.expand_path('../fixtures/definitions.json', __dir__)))
    @revision = 1
    @available = true
    @fetches = []
    @server = Puma::Server.new(method(:call))
    @server.add_tcp_listener('127.0.0.1', 0)
    @url = "http://127.0.0.1:#{@server.binder.ios.first.addr[1]}/"
    @server.run
  end

  def call(env)
    return [404, {}, ['not found']] unless env['PATH_INFO'] == '/definitions/local-fixture/Production'

    payload, revision, available = @mutex.synchronize do
      @fetches << Process.clock_gettime(Process::CLOCK_MONOTONIC)
      [JSON.generate(@definitions), @revision, @available]
    end
    [available ? 200 : 503, { 'content-type' => 'application/json', 'etag' => revision.to_s }, [payload]]
  end

  def toggle(key, enabled)
    @mutex.synchronize do
      definition = @definitions.find { |item| item['featureKey'] == key }
      raise ArgumentError, 'Unknown fixture flag' unless definition
      definition['filters'] = enabled ? [{ 'name' => 'AlwaysOn' }] : []
      @revision += 1
    end
  end

  def available=(value)
    @mutex.synchronize { @available = value }
  end

  def fetches
    @mutex.synchronize { @fetches.dup }
  end

  def close
    @server.stop(true)
  end
end
