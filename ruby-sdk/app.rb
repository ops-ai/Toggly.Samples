# frozen_string_literal: true

require 'rack'
require 'rack/session/cookie'
require 'securerandom'
require 'json'
require_relative 'lib/feature_service'
require_relative 'lib/request_context'
require_relative 'lib/view'

module RubyShowcase
  class Application
    def self.build(service:, secret:, secure: false)
      Rack::Builder.new do
        use Rack::Session::Cookie,
            key: 'ruby_showcase', secret: secret, httponly: true,
            same_site: :lax, secure: secure, expire_after: 3600
        run Application.new(service)
      end.to_app
    end

    def initialize(service)
      @service = service
    end

    def call(env)
      request = Rack::Request.new(env)
      session = request.session
      session['state'] ||= RequestContext::PRESETS.fetch('matching').dup
      session['csrf'] ||= SecureRandom.hex(32)
      state = session['state']
      context = RequestContext.build(state, env)

      # Context is fully assembled before any flag check in any route.
      if request.get?
        return get(request, context, state, session)
      elsif request.post?
        return response(413, 'Request body too large') if request.content_length.to_i > 8192
        token = request.params['csrf']
        unless token.is_a?(String) && Rack::Utils.secure_compare(session['csrf'], token)
          return response(403, 'Invalid CSRF token; reload the page and try again')
        end
        return post(request, context, state, session)
      end
      response(405, 'Method not allowed')
    rescue ArgumentError, Rack::QueryParser::ParameterTypeError, Rack::QueryParser::InvalidParameterError => error
      response(422, error.message)
    end

    private

    def get(request, context, state, session)
      path = request.path_info
      if %w[/style.css /snapshot.js].include?(path)
        type = path.end_with?('.css') ? 'text/css' : 'text/javascript'
        return response(200, File.read(File.join(__dir__, 'public', path.delete_prefix('/'))), type)
      end
      if path == '/api/snapshot'
        return json(200, mode: @service.configuration.mode, ready: @service.client.ready,
                         context: context.to_h, csrf: session['csrf'], flags: @service.snapshot(context),
                         telemetry: @service.telemetry.summary)
      end
      if { '/api/v2' => 'api-v2', '/beta' => 'beta-access' }.key?(path)
        flag = { '/api/v2' => 'api-v2', '/beta' => 'beta-access' }.fetch(path)
        allowed = @service.client.enabled?(flag, context: context)
        return json(allowed ? 200 : 403, allowed: allowed, flag: flag, identity: context.identity)
      end
      return response(404, 'Page not found') unless Catalog::SECTIONS.key?(path)

      notice = session.delete('notice')
      view = View.new(service: @service, context: context, state: state, csrf: session['csrf'], path: path, notice: notice)
      response(200, view.render, 'text/html')
    end

    def post(request, context, state, session)
      case request.path_info
      when '/context'
        # Replace only this signed session state. Existing requests keep their
        # independent context values until their responses have completed.
        session['state'] = RequestContext.validate(request.params, state)
        redirect(Catalog::SECTIONS.key?(request.params['return_to']) ? request.params['return_to'] : '/identity')
      when '/actions/submit'
        return response(403, 'enhanced-submit is OFF; action denied') unless @service.client.enabled?('enhanced-submit', context: context)
        title = request.params['title']
        return response(422, 'Title must contain 1–80 characters') unless title.is_a?(String) && (1..80).cover?(title.strip.length)

        @service.client.record_usage('enhanced-submit', identity: context.identity)
        @service.client.measure('submission-title-length', title.strip.length, feature: 'enhanced-submit')
        @service.client.increment_counter('submissions', feature: 'enhanced-submit')
        @service.client.observe('submission-size', title.bytesize, feature: 'enhanced-submit')
        session['notice'] = 'Demo submission accepted; native usage and metrics recorded locally. No data was saved.'
        redirect('/api')
      when '/actions/refresh'
        @service.client.refresh(force: true)
        session['notice'] = 'Native refresh requested. Inspect current readiness and evaluations below.'
        redirect('/sdk')
      when '/actions/flush'
        @service.client.record_view('new-dashboard', identity: context.identity)
        @service.client.flush_telemetry
        session['notice'] = 'Native usage and metrics batches flushed into the local capture transport.'
        redirect('/sdk')
      else
        response(404, 'Action not found')
      end
    end

    def redirect(path)
      [303, security_headers.merge('location' => path, 'content-type' => 'text/plain; charset=utf-8'), ['See other']]
    end

    def json(status, value)
      response(status, JSON.generate(value), 'application/json')
    end

    def response(status, body, type = 'text/plain')
      [status, security_headers.merge('content-type' => "#{type}; charset=utf-8"), [body]]
    end

    def security_headers
      {
        'cache-control' => 'no-store',
        'x-content-type-options' => 'nosniff',
        'content-security-policy' => "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
        'referrer-policy' => 'same-origin'
      }
    end
  end
end
