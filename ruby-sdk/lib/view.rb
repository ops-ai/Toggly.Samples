# frozen_string_literal: true

require 'erb'
require 'json'
require 'rack/utils'

module RubyShowcase
  class View
    def initialize(service:, context:, state:, csrf:, path:, notice: nil)
      @service = service
      @client = service.client
      @context = context
      @state = state
      @csrf = csrf
      @path = path
      @notice = notice
      @flags = service.snapshot(context)
      @title = Catalog::SECTIONS.fetch(path).first
    end

    def render
      template = { '/' => 'home', '/gates' => 'gates', '/api' => 'api', '/identity' => 'identity',
                   '/orders' => 'orders', '/filters' => 'filters', '/sdk' => 'sdk', '/setup' => 'setup' }.fetch(@path)
      @content = partial(template)
      partial('layout')
    end

    def partial(name)
      ERB.new(File.read(File.expand_path("../views/#{name}.erb", __dir__))).result(binding)
    end

    def h(value)
      Rack::Utils.escape_html(value.to_s)
    end

    def enabled?(key, context = @context)
      @client.enabled?(key, context: context)
    end

    def state_badge(enabled)
      "<span class=\"badge #{enabled ? 'on' : 'off'}\">#{enabled ? 'ON' : 'OFF'}</span>"
    end

    def csrf_field
      "<input type=\"hidden\" name=\"csrf\" value=\"#{h(@csrf)}\">"
    end
  end
end
