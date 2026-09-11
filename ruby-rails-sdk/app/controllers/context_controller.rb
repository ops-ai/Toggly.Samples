class ContextController < ApplicationController
  def update
    # Validate the complete next state before mutating the encrypted session.
    values = params.permit(:preset, :identity, :role, :country, :language, :user_agent, :order, :header_source).to_h
    session[:demo_state] = RequestContext.validate(values, demo_state)
    redirect_to '/filters', status: :see_other, notice: 'Demo context updated for this browser.'
  rescue ArgumentError => error
    render plain: error.message, status: :unprocessable_entity
  end
end
