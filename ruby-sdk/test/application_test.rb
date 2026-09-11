# frozen_string_literal: true

require 'minitest/autorun'
require 'rack/mock'
require 'json'

class ApplicationTest < Minitest::Test
  def setup
    # Loading fails meaningfully until the production application exists.
    require_relative '../app'
    @service = RubyShowcase::FeatureService.new(RubyShowcase::Configuration.new({}))
    @app = RubyShowcase::Application.build(service: @service, secret: 's' * 64)
    @browser = Rack::MockRequest.new(@app)
  end

  def teardown
    @service&.close
  end

  def snapshot(cookie = nil)
    response = @browser.get('/api/snapshot', 'HTTP_COOKIE' => cookie)
    [JSON.parse(response.body), response['set-cookie']&.split(';')&.first]
  end

  def test_keyless_startup_renders_all_sections_and_native_defaults
    %w[/ /gates /api /identity /orders /filters /sdk /setup].each do |path|
      response = @browser.get(path)
      assert_equal 200, response.status, path
      assert_includes response.body, 'No app key'
      assert_includes response.body, 'Ruby SDK Sample'
    end
    data, = snapshot
    assert_equal 16, data.fetch('flags').length
    assert data.fetch('flags').none? { |flag| flag.fetch('enabled') }
    assert_equal 'offline', data.fetch('mode')
    assert_equal true, data.fetch('ready')
  end

  def test_sessions_keep_personas_separate_and_context_exists_before_evaluation
    data, alice_cookie = snapshot
    response = @browser.post('/context', 'HTTP_COOKIE' => alice_cookie,
      params: { csrf: data.fetch('csrf'), preset: 'non-matching', return_to: '/identity' })
    assert_equal 303, response.status
    bob_cookie = response['set-cookie'].split(';').first
    bob, = snapshot(bob_cookie)
    alice, = snapshot(alice_cookie)
    assert_equal 'bob', bob.dig('context', 'identity')
    assert_equal 'alice', alice.dig('context', 'identity')
    assert_equal 'ord-standard', bob.dig('context', 'entity', 'key')
    assert_equal 'ord-vip', alice.dig('context', 'entity', 'key')
  end

  def test_csrf_and_validation_are_checked_before_actions_or_session_changes
    data, cookie = snapshot
    denied = @browser.post('/context', 'HTTP_COOKIE' => cookie, params: { preset: 'non-matching' })
    assert_equal 403, denied.status
    invalid = @browser.post('/context', 'HTTP_COOKIE' => cookie,
      params: { csrf: data.fetch('csrf'), identity: 'a' * 129, order: 'ord-vip' })
    assert_equal 422, invalid.status
    assert_equal 'alice', snapshot(cookie).first.dig('context', 'identity')
    action = @browser.post('/actions/submit', 'HTTP_COOKIE' => cookie,
      params: { csrf: data.fetch('csrf'), title: 'Example' })
    assert_equal 403, action.status
    assert_equal 403, @browser.get('/api/v2').status
    assert_equal 403, @browser.get('/beta').status
  end

  def test_unrecognized_routes_and_escaped_input_do_not_render_untrusted_markup
    assert_equal 404, @browser.get('/missing').status
    data, cookie = snapshot
    response = @browser.post('/context', 'HTTP_COOKIE' => cookie,
      params: { csrf: data.fetch('csrf'), identity: '<script>alert(1)</script>',
                role: 'admin', country: 'US', language: 'en', user_agent: 'Example',
                order: 'ord-vip', header_source: 'preset' })
    assert_equal 303, response.status
    html = @browser.get('/identity', 'HTTP_COOKIE' => response['set-cookie'].split(';').first).body
    refute_includes html, '<script>alert(1)</script>'
    assert_includes html, '&lt;script&gt;'
  end
end
