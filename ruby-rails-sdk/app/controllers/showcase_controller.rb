class ShowcaseController < ApplicationController
  def home
  end
  def gates
  end
  def api
  end
  def identity
  end
  def orders
  end
  def filters
  end
  def sdk
  end
  def setup
  end

  def snapshot
    render json: snapshot_data
  end
end
