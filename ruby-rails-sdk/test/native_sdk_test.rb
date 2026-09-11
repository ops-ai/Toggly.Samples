require_relative 'test_helper'

class NativeSdkTest < ActiveSupport::TestCase
  test 'exact shared native matrix and sticky percentage without invented negatives' do
    alice = RequestContext.build(RequestContext::PRESETS.fetch('matching'))
    bob = RequestContext.build(RequestContext::PRESETS.fetch('non-matching'))
    expected = {
      'always-on' => [true, true],
      'percentage' => [true, true],
      'targeting' => [true, true],
      'user-claims' => [true, false],
      'time-window' => [true, true],
      'country' => [true, false],
      'browser-family' => [true, false],
      'browser-language' => [true, false],
      'device-type' => [false, false],
      'os' => [true, false],
      'context-property' => [true, false]
    }
    expected.each do |suffix, values|
      assert_equal values, [alice, bob].map { |ctx| Toggly.client.enabled?("filter-#{suffix}", context: ctx) }, suffix
    end
    assert_equal 1, 20.times.map { Toggly.client.enabled?('filter-percentage', context: alice) }.uniq.length
    assert_equal 16, Toggly.client.feature_keys.length
    assert_empty Toggly.client.public_methods.grep(/variant/)
    refute Toggly.client.enabled?('missing-demo-flag', context: alice)
    assert Toggly.client.disabled?('missing-demo-flag', context: alice)
  end

  test 'same-user entity replacement preserves original frozen context' do
    alice = RequestContext.build(RequestContext::PRESETS.fetch('matching'))
    other = alice.with_entity(RequestContext::ORDERS.fetch('ord-standard').to_toggly_entity)
    assert Toggly.client.enabled?('ExpressCheckout', context: alice)
    refute Toggly.client.enabled?('ExpressCheckout', context: other)
    assert_equal alice.identity, other.identity
    assert_equal 'ord-vip', alice.entity.key
    assert alice.frozen?
    assert alice.entity.attributes.frozen?
    assert_raises(FrozenError) { alice.entity.attributes['Vip'] = false }
  end

  test 'actual HTTP headers use the native mapper without replacing claims or identity' do
    request = ActionDispatch::Request.new(
      'HTTP_CF_IPCOUNTRY' => 'CA',
      'HTTP_USER_AGENT' => RequestContext::OTHER_UA,
      'HTTP_ACCEPT_LANGUAGE' => 'fr-FR,fr;q=0.9'
    )
    state = RequestContext::PRESETS.fetch('matching').merge('header_source' => 'actual')
    context = RequestContext.build(state, request)
    assert_equal 'alice', context.identity
    assert_equal 'admin', context.claims['role']
    assert_equal 'CA', context.request.country
    refute Toggly.client.enabled?('filter-country', context: context)
    assert Toggly.client.enabled?('filter-user-claims', context: context)
  end

  test 'native middleware clears context on entry and errors' do
    env = { 'toggly.context' => 'old', 'toggly.current_user' => 'old' }
    middleware = Toggly::Rails::Middleware.new(lambda do |current|
      assert_empty current
      current['toggly.context'] = 'temporary'
      current['toggly.current_user'] = 'temporary'
      raise 'deliberate fixture error'
    end)
    assert_raises(RuntimeError) { middleware.call(env) }
    assert_empty env
  end

  test 'native Rails snapshot retains sixteen definitions and metadata' do
    provider = Toggly::Rails::CacheSnapshotProvider.new(key_prefix: Toggly::Rails.configuration.cache_key_prefix)
    assert provider.exists?
    restored = provider.load
    assert_equal 16, restored.fetch(:definitions).size
    assert restored.fetch(:metadata).key?(:saved_at)
  end

  test 'context validation rejects malformed input atomically' do
    original = RequestContext::PRESETS.fetch('matching')
    [{ 'preset' => 'unlisted' }, { 'identity' => 'x' * 129 }, { 'order' => 'missing' }, { 'country' => 'usa' },
     { 'header_source' => 'untrusted' }, { 'role' => "admin\n" }].each do |values|
      assert_raises(ArgumentError) { RequestContext.validate(values, original) }
    end
    assert_equal 'alice', original['identity']
  end
end
