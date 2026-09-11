class ApplicationController < ActionController::Base
  protect_from_forgery with: :exception
  # Railtie already included ControllerConcern. Establish demo state before its
  # set_toggly_context callback; never call a global identity setter.
  prepend_before_action :prepare_demo_state
  before_action :private_response
  helper_method :demo_state, :snapshot_data, :toggly_context

  protected

  def toggly_current_user
    demo_state
  end

  def demo_state
    @demo_state
  end

  def snapshot_data
    {
      mode: Rails.application.config.x.toggly_mode,
      ready: Toggly.client.ready,
      flags: Catalog::FLAGS.map do |key|
        result = Toggly.client.evaluate(key, context: toggly_context)
        { key: key, enabled: feature_enabled?(key), reason: result.reason }
      end,
      context: {
        identity: toggly_context.identity,
        order: toggly_context.entity.key,
        vip: toggly_context.entity.attributes['Vip'],
        claims: toggly_context.claims,
        header_source: demo_state['header_source']
      }
    }
  end

  private

  def prepare_demo_state
    @demo_state = RequestContext.validate({}, session[:demo_state] || RequestContext::PRESETS.fetch('matching'))
  end

  def private_response
    response.headers['Cache-Control'] = 'no-store'
  end
end
