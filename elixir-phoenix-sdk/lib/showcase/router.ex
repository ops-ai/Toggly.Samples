defmodule Showcase.Router do
  use Phoenix.Router
  import Phoenix.LiveView.Router

  pipeline :browser do
    plug(:accepts, ["html"])
    plug(:fetch_session)
    plug(:protect_from_forgery)
    plug(:put_secure_browser_headers)
    plug(:put_root_layout, html: {Showcase.Layouts, :root})
  end

  pipeline :feature_gate do
    # A route gate is server-side; application authentication/authorization still
    # belongs before this plug. This demo has no authenticated accounts.
    plug(Toggly.Phoenix.Plug, client: Showcase.Flags, gate: "beta-access")
  end

  scope "/" do
    pipe_through(:browser)
    live("/", Showcase.Live)
  end

  scope "/" do
    pipe_through([:browser, :feature_gate])
    get("/protected", Showcase.ProtectedController, :index)
  end
end

defmodule Showcase.ProtectedController do
  use Phoenix.Controller, formats: [:html]
  def index(conn, _), do: text(conn, "beta-access enabled: protected feature route")
end
