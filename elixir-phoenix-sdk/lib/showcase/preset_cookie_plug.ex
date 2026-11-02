defmodule Showcase.PresetCookiePlug do
  @moduledoc false
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    case Showcase.PresetSources.from_conn(conn) do
      "anonymous" ->
        case Showcase.FilterEvalCookies.context_from_conn(conn) do
          nil ->
            conn

          context ->
            conn
            |> put_session("toggly_context", context)
            |> put_private(:showcase_filter_context_capture, context)
        end

      normalized when is_binary(normalized) ->
        conn
        |> put_resp_cookie("sample-preset", normalized, path: "/", same_site: "Lax")
        |> put_session("sample_preset", normalized)
        |> put_session("toggly_context", Showcase.Context.preset(normalized))
        |> put_private(:showcase_preset_capture, normalized)

      _ ->
        conn
    end
  end
end
