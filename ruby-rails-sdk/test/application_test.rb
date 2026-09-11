require_relative 'test_helper'

class ApplicationTest < ActionDispatch::IntegrationTest
  setup do
    host! 'localhost'
  end

  def csrf
    get '/'
    assert_response :success
    Nokogiri::HTML(response.body).at_css('meta[name="csrf-token"]')['content']
  end

  test 'all eight sections render native Rails views and sixteen checklist rows' do
    Catalog::SECTIONS.each_key do |path|
      get path
      assert_response :success
      assert_select 'h1', 1
      assert_match 'Ruby Rails SDK Sample', response.body
    end
    get '/'
    assert_select 'tr[data-flag]', 16
    get '/filters'
    assert_select 'tr[data-filter]', 11
  end

  test 'snapshot rows retain one native decision when definitions refresh between calls' do
    client = Toggly.client
    decisions = []
    first_result = nil
    # Observe real native calls without replacing the SDK or its evaluator.
    # Refresh just after one result returns to reproduce the old two-call race.
    trace = TracePoint.new(:call, :return) do |event|
      next unless event.self.equal?(client)

      if event.event == :call && %i[evaluate enabled?].include?(event.method_id)
        decisions << [event.method_id, event.binding.local_variable_get(:feature_key)]
      elsif event.event == :return && event.method_id == :evaluate && first_result.nil?
        first_result = event.return_value
        FIXTURE.toggle('new-dashboard', false)
        client.refresh(force: true)
      end
    end
    trace.enable { get '/api/snapshot' }

    assert_response :success
    assert_equal 'new-dashboard', first_result.feature_key
    assert first_result.enabled, 'The returned result must precede the refresh'
    refute client.enabled?('new-dashboard'), 'The real SDK must now see the refreshed OFF definition'
    row = response.parsed_body.fetch('flags').find { |flag| flag['key'] == 'new-dashboard' }
    assert_equal first_result.enabled, row.fetch('enabled')
    assert_equal first_result.reason, row.fetch('reason')
    assert_equal Catalog::FLAGS.map { |key| [:evaluate, key] }, decisions,
      'Each row needs one native evaluation and no second boolean check'
    # Other rows can observe newer definitions; this is not whole-table atomicity.
  end

  test 'native helpers render enabled and disabled blocks' do
    get '/gates'
    assert_includes response.body, 'New dashboard enabled'
    refute_includes response.body, 'Classic dashboard fallback'
    FIXTURE.toggle('new-dashboard', false)
    Toggly.client.refresh(force: true)
    get '/gates'
    assert_includes response.body, 'Classic dashboard fallback'
    refute_includes response.body, 'New dashboard enabled'
  end

  test 'Any and All reflect every combination of the two native flags' do
    [false, true].product([false, true]).each do |dashboard, api|
      FIXTURE.toggle('new-dashboard', dashboard)
      FIXTURE.toggle('api-v2', api)
      Toggly.client.refresh(force: true)
      get '/gates'
      document = Nokogiri::HTML(response.body)
      any = document.css('p').find { |node| node.text.start_with?('Any enabled:') }.at_css('.badge').text
      all = document.css('p').find { |node| node.text.start_with?('All enabled:') }.at_css('.badge').text
      assert_equal(dashboard || api ? 'ON' : 'OFF', any)
      assert_equal(dashboard && api ? 'ON' : 'OFF', all)
    end
  end

  test 'HTML JSON and mutation gates use the native 404 behavior' do
    token = csrf
    get '/beta'
    assert_response :success
    get '/api/v2'
    assert_response :success
    post '/actions/submit', params: { authenticity_token: token, title: 'Accepted' }
    assert_response :see_other
    %w[beta-access api-v2 enhanced-submit].each { |key| FIXTURE.toggle(key, false) }
    Toggly.client.refresh(force: true)
    get '/beta', headers: { 'Accept' => 'text/html' }
    assert_response :not_found
    assert_includes response.body, 'native Rails feature gate returned 404'
    get '/api/v2', headers: { 'Accept' => 'application/json' }
    assert_response :not_found
    assert_equal({ 'error' => 'Not found' }, response.parsed_body)
    post '/actions/submit', params: { authenticity_token: token, title: 'Denied' }
    assert_response :not_found
    get '/api'
    assert_includes response.body, 'Accepted'
    refute_includes response.body, '>Denied<'
  end

  test 'native CSRF rejection and valid encrypted-session updates' do
    token = csrf
    post '/context', params: { preset: 'non-matching' }
    assert_response :unprocessable_entity
    get '/api/snapshot'
    assert_equal 'alice', response.parsed_body.dig('context', 'identity')
    post '/context', params: { authenticity_token: token, preset: 'non-matching' }
    assert_response :see_other
    get '/api/snapshot'
    assert_equal 'bob', response.parsed_body.dig('context', 'identity')
    assert_equal 'ord-standard', response.parsed_body.dig('context', 'order')
    post '/context', params: { authenticity_token: token, identity: '<script>alert(1)</script>' }
    assert_response :see_other
    get '/identity'
    refute_includes response.body, '<script>alert(1)</script>'
    assert_includes response.body, '&lt;script&gt;alert(1)&lt;/script&gt;'
  end

  test 'invalid form and foreign origin cannot change state' do
    token = csrf
    post '/context', params: { authenticity_token: token, order: 'unlisted' }
    assert_response :unprocessable_entity
    post '/context', params: { authenticity_token: token, preset: 'non-matching' }, headers: { 'Origin' => 'https://foreign.invalid' }
    assert_response :unprocessable_entity
    get '/api/snapshot'
    assert_equal 'alice', response.parsed_body.dig('context', 'identity')
    post '/actions/submit', params: { authenticity_token: token, title: '' }
    assert_response :unprocessable_entity
  end

  test 'two Rails sessions retain independent identity and same-user Order changes' do
    alice = open_session
    bob = open_session
    [alice, bob].each { |browser| browser.host! 'localhost' }
    bob.get '/'
    token = Nokogiri::HTML(bob.response.body).at_css('meta[name="csrf-token"]')['content']
    bob.post '/context', params: { authenticity_token: token, preset: 'non-matching' }
    alice.get '/api/snapshot'
    assert_equal 'alice', alice.response.parsed_body.dig('context', 'identity')
    bob.get '/api/snapshot'
    assert_equal 'bob', bob.response.parsed_body.dig('context', 'identity')
    bob.post '/context', params: { authenticity_token: token, order: 'ord-vip' }
    bob.get '/api/snapshot'
    assert_equal 'bob', bob.response.parsed_body.dig('context', 'identity')
    assert bob.response.parsed_body['flags'].find { |flag| flag['key'] == 'ExpressCheckout' }['enabled']
  end
end
