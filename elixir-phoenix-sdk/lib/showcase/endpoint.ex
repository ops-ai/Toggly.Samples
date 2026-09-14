defmodule Showcase.Endpoint do
  use Phoenix.Endpoint, otp_app: :toggly_showcase

  @session_options [
    store: :cookie,
    key: "_toggly_showcase",
    signing_salt: "showcase-session",
    same_site: "Lax"
  ]
  socket("/live", Phoenix.LiveView.Socket, websocket: [connect_info: [session: @session_options]])
  plug(Plug.Static, at: "/", from: :toggly_showcase, only: ~w(assets))
  plug(Plug.RequestId)

  plug(Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Jason
  )

  plug(Plug.Session, @session_options)
  plug(Showcase.Router)
end

defmodule Showcase.ErrorHTML do
  def render(template, _), do: Phoenix.Controller.status_message_from_template(template)
end
