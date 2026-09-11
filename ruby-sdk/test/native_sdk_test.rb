# frozen_string_literal: true

require 'minitest/autorun'
require 'tmpdir'
require_relative '../app'
require_relative 'support/fixture_server'

class NativeSdkTest < Minitest::Test
  def setup
    @fixture = FixtureServer.new
    @directory = Dir.mktmpdir('ruby-native-test')
    @config = RubyShowcase::Configuration.new(
      'TOGGLY_APP_KEY' => 'local-fixture', 'TOGGLY_LOCAL_FIXTURE' => 'true',
      'TOGGLY_DEFINITIONS_URL' => @fixture.url,
      'TOGGLY_SNAPSHOT_PATH' => File.join(@directory, 'definitions.json'),
      'TOGGLY_REFRESH_INTERVAL' => '1'
    )
    @service = RubyShowcase::FeatureService.new(@config)
    @client = @service.client
    @alice = RubyShowcase::RequestContext.build(RubyShowcase::RequestContext::PRESETS['matching'])
    @bob = RubyShowcase::RequestContext.build(RubyShowcase::RequestContext::PRESETS['non-matching'])
  end

  def teardown
    @service&.close
    @fixture&.close
    FileUtils.remove_entry(@directory) if @directory
  end

  def test_native_exact_matrix_and_sticky_identity
    expected = {
      'always-on' => [true, true], 'percentage' => [true, true],
      'targeting' => [true, true], 'user-claims' => [true, false],
      'time-window' => [true, true], 'country' => [true, false],
      'browser-family' => [true, false], 'browser-language' => [true, false],
      'device-type' => [false, false], 'os' => [true, false],
      'context-property' => [true, false]
    }
    expected.each do |suffix, values|
      actual = [@alice, @bob].map { |context| @client.enabled?("filter-#{suffix}", context: context) }
      assert_equal values, actual, suffix
    end
    outcomes = 20.times.map { @client.enabled?('filter-percentage', context: @alice) }
    assert_equal 1, outcomes.uniq.size
    assert_equal 1, @fixture.fetches.size, 'evaluations must not fetch'
    assert_equal 16, @client.feature_keys.size
    assert_empty @client.public_methods.grep(/variant/)
  end

  def test_same_user_different_orders_and_concurrent_contexts
    assert @client.enabled?('ExpressCheckout', context: @alice)
    refute @client.enabled?('ExpressCheckout', context: @alice.with_entity(@bob.entity))
    threads = 24.times.map do |index|
      Thread.new do
        context = index.even? ? @alice : @bob
        [context.identity, @client.enabled?('ExpressCheckout', context: context),
         @client.enabled?('filter-user-claims', context: context)]
      end
    end
    threads.each_with_index do |thread, index|
      assert_equal(index.even? ? ['alice', true, true] : ['bob', false, false], thread.value)
    end
    assert @alice.frozen?
    assert @alice.entity.attributes.frozen?
    assert_equal 'ord-vip', @alice.entity.key
  end

  def test_native_refresh_file_restore_and_false_ready_during_outage
    @fixture.toggle('new-dashboard', false)
    assert @client.refresh(force: true)
    refute @client.enabled?('new-dashboard', context: @alice)
    assert File.exist?(@config.snapshot_path)
    @service.close
    @fixture.available = false
    @service = RubyShowcase::FeatureService.new(@config)
    assert_equal false, @service.client.ready
    assert @service.client.enabled?('api-v2', context: @alice), 'restored enabled flag proves native snapshot use'
    refute @service.client.enabled?('new-dashboard', context: @alice)
    refute @service.client.refresh(force: true)
    assert @service.client.enabled?('api-v2', context: @alice)
  end

  def test_unknown_defaults_diagnostics_and_native_telemetry_shutdown
    refute @client.enabled?('missing', context: @alice)
    assert @client.disabled?('missing', context: @alice)
    assert_equal 'feature_not_found', @client.evaluate('missing', context: @alice).reason
    @client.record_view('new-dashboard', identity: 'alice')
    @client.record_usage('new-dashboard', identity: 'alice')
    @client.measure('amount', 12.5, feature: 'new-dashboard')
    @client.increment_counter('attempt', feature: 'new-dashboard')
    @client.observe('latency', 5, feature: 'new-dashboard')
    @service.close
    assert @client.closed?
    counts = @service.telemetry.summary
    assert_operator counts[:usage_batches], :>=, 1
    assert_operator counts[:metric_batches], :>=, 1
    assert counts[:closed]
  end

  def test_http_header_mapping_uses_actual_headers_only_when_selected
    state = RubyShowcase::RequestContext::PRESETS['matching'].merge('header_source' => 'actual')
    context = RubyShowcase::RequestContext.build(state, 'HTTP_CF_IPCOUNTRY' => 'CA', 'HTTP_USER_AGENT' => 'Firefox', 'HTTP_ACCEPT_LANGUAGE' => 'fr')
    assert_equal 'alice', context.identity
    assert_equal 'CA', context.request.country
    refute @client.enabled?('filter-country', context: context)
    assert @client.enabled?('filter-user-claims', context: context)
  end

  def test_actual_application_route_and_submission_native_gates
    browser = Rack::MockRequest.new(RubyShowcase::Application.build(service: @service, secret: 's' * 64))
    start = browser.get('/api/snapshot')
    cookie = start['set-cookie'].split(';').first
    csrf = JSON.parse(start.body).fetch('csrf')
    assert_equal 200, browser.get('/api/v2', 'HTTP_COOKIE' => cookie).status
    assert_equal 200, browser.get('/beta', 'HTTP_COOKIE' => cookie).status
    assert_equal 422, browser.post('/actions/submit', 'HTTP_COOKIE' => cookie, params: { csrf: csrf, title: ' ' }).status
    assert_equal 303, browser.post('/actions/submit', 'HTTP_COOKIE' => cookie, params: { csrf: csrf, title: 'Native test' }).status
    @fixture.toggle('api-v2', false)
    @fixture.toggle('enhanced-submit', false)
    @client.refresh(force: true)
    assert_equal 403, browser.get('/api/v2', 'HTTP_COOKIE' => cookie).status
    assert_equal 403, browser.post('/actions/submit', 'HTTP_COOKIE' => cookie, params: { csrf: csrf, title: 'Native test' }).status
    @client.flush_telemetry
    assert_operator @service.telemetry.summary[:metric_batches], :>=, 1
  end
end
