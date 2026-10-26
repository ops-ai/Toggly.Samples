defmodule Showcase.PresetCookiePlug do
  @moduledoc false
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    conn = fetch_cookies(conn)

    case preset_from_conn(conn) do
      value when is_binary(value) and value != "" ->
        normalized =
          case value do
            "non-matching" -> "nonmatching"
            other -> other
          end

        conn
        |> put_session("sample_preset", normalized)
        |> put_session("toggly_context", Showcase.Context.preset(normalized))

      _ ->
        # Leave an existing harness preset in session when this request omits
        # preset cookies/headers (e.g. follow-up navigations).
        conn
    end
  end

  defp preset_from_conn(conn) do
    conn.req_cookies["sample-preset"] ||
      conn.req_cookies["toggly-preset"] ||
      header_preset(conn)
  end

  defp header_preset(conn) do
    case Plug.Conn.get_req_header(conn, "x-demo-preset") do
      [value | _] when is_binary(value) and value != "" -> value
      _ -> nil
    end
  end
end
