# frozen_string_literal: true

require 'toggly'

module RequestContext
  MATCHING_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  OTHER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
  PRESETS = {
    'matching' => {
      'identity' => 'alice', 'role' => 'admin', 'country' => 'US',
      'language' => 'en-US,en;q=0.9', 'user_agent' => MATCHING_UA,
      'order' => 'ord-vip', 'header_source' => 'preset'
    }.freeze,
    'non-matching' => {
      'identity' => 'bob', 'role' => 'user', 'country' => 'CA',
      'language' => 'fr-FR,fr;q=0.9', 'user_agent' => OTHER_UA,
      'order' => 'ord-standard', 'header_source' => 'preset'
    }.freeze
  }.freeze

  ORDERS = {
    'ord-vip' => Order.new('ord-vip', true, 149.95),
    'ord-standard' => Order.new('ord-standard', false, 20.0)
  }.freeze

  def self.validate(params, previous)
    if params.key?('preset') && !PRESETS.key?(params['preset'])
      raise ArgumentError, 'Choose a listed preset'
    end
    return PRESETS.fetch(params['preset']).dup if PRESETS.key?(params['preset'])

    values = previous.merge(params.select { |key, _| PRESETS['matching'].key?(key) })
    limits = { 'identity' => 128, 'role' => 32, 'country' => 2, 'language' => 128, 'user_agent' => 512 }
    limits.each do |key, limit|
      value = values[key]
      unless value.is_a?(String) && value.bytesize <= limit && !value.match?(/[\x00-\x1f]/)
        raise ArgumentError, "Invalid #{key}; maximum #{limit} bytes, no control characters"
      end
    end
    raise ArgumentError, 'Choose a listed Order' unless ORDERS.key?(values['order'])
    raise ArgumentError, 'Choose preset or actual headers' unless %w[preset actual].include?(values['header_source'])
    raise ArgumentError, 'Country must be two uppercase letters or empty' unless values['country'].match?(/\A(?:[A-Z]{2})?\z/)
    values
  end

  def self.build(state, request = nil)
    # Demo claims are user-editable teaching inputs, never authentication.
    base = Toggly::Context.new(identity: state['identity'], claims: { 'role' => state['role'] })
    headers = if state['header_source'] == 'actual'
      {
        'user-agent' => request&.user_agent.to_s,
        'accept-language' => request&.headers&.[]('Accept-Language').to_s,
        'cf-ipcountry' => request&.headers&.[]('CF-IPCountry').to_s
      }
    else
      { 'cf-ipcountry' => state['country'], 'accept-language' => state['language'], 'user-agent' => state['user_agent'] }
    end
    context = Toggly::HttpRequestMapper.merge_into(headers, base)
    entity = ORDERS.fetch(state['order']).to_toggly_entity
    context = context.with_entity(entity)
    # Freeze this request-owned value graph. Never cache using native cache_key,
    # which omits entity data and definition revisions.
    freeze_value(context)
  end

  def self.freeze_value(value)
    case value
    when Hash
      value.each do |key, item|
        freeze_value(key)
        freeze_value(item)
      end
    when Array
      value.each { |item| freeze_value(item) }
    else
      value.instance_variables.each { |name| freeze_value(value.instance_variable_get(name)) }
      value.each_pair { |_key, item| freeze_value(item) } if value.is_a?(Struct)
    end
    value.freeze
  end
end
