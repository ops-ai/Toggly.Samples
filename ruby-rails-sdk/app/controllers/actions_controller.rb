class ActionsController < ApplicationController
  before_action -> { require_feature!('api-v2') }, only: :version_two
  before_action -> { require_feature!('beta-access') }, only: :beta
  before_action -> { require_feature!('enhanced-submit') }, only: :submit

  def version_two
    render json: { version: 2, identity: toggly_context.identity, order: toggly_context.entity.key }
  end

  def beta
    render plain: 'Native Rails beta gate allowed this request.'
  end

  def submit
    title = params[:title]
    unless title.is_a?(String) && (1..80).cover?(title.strip.length)
      return render plain: 'Title must contain 1–80 characters.', status: :unprocessable_entity
    end
    session[:last_submission] = title.strip
    redirect_to '/api', status: :see_other, notice: "Accepted demo submission: #{title.strip}"
  end

  def refresh
    Toggly.client.refresh(force: true)
    # refresh rescues transport failures itself. A returned call is not proof of
    # successful network fetch; show native readiness and current values.
    redirect_to '/sdk', status: :see_other, notice: 'Refresh attempted. Inspect readiness and current definitions below.'
  end
end
