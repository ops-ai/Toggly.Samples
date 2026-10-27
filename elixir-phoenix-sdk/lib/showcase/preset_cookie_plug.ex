defmodule Showcase.PresetCookiePlug do
  @moduledoc false
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    case Showcase.PresetSources.from_conn(conn) do
      "anonymous" ->
        conn

      normalized when is_binary(normalized) ->
        conn
        |> put_resp_cookie("sample-preset", normalized, path: "/", same_site: "Lax")
        |> put_session("sample_preset", normalized)
        |> put_session("toggly_context", Showcase.Context.preset(normalized))

      _ ->
        conn
    end
  end
end
