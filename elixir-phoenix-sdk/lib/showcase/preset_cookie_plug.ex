defmodule Showcase.PresetCookiePlug do
  @moduledoc false
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    conn = fetch_query_params(conn)

    raw_preset = Showcase.PresetSources.from_conn(conn)

    preset =
      if raw_preset == nil and invalid_explicit_preset?(conn) do
        "anonymous"
      else
        raw_preset
      end

    case preset do
      "anonymous" ->
        conn =
          if explicit_anonymous_query?(conn) or invalid_explicit_preset?(conn) do
            conn
            |> delete_session("sample_preset")
            |> delete_session("toggly_context")
          else
            conn
          end

        case Showcase.FilterEvalCookies.context_from_conn(conn) do
          nil ->
            if session_has_named_preset?(conn) do
              conn
            else
              conn |> delete_session("toggly_context")
            end

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

  defp session_has_named_preset?(conn) do
    case get_session(conn, "sample_preset") do
      preset when preset in ["matching", "nonmatching"] -> true
      _ -> false
    end
  rescue
    _ -> false
  end

  defp explicit_anonymous_query?(conn) do
    Map.get(conn.query_params, "preset") == "anonymous"
  end

  defp invalid_explicit_preset?(conn) do
    case Map.get(conn.query_params, "preset") do
      nil -> false
      "" -> false
      "none" -> false
      "anonymous" -> false
      "matching" -> false
      "nonmatching" -> false
      "non-matching" -> false
      _ -> true
    end
  end
end
