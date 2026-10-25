defmodule Showcase.PresetCookiePlug do
  @moduledoc false
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    conn = fetch_cookies(conn)

    case conn.req_cookies["sample-preset"] || conn.req_cookies["toggly-preset"] do
      value when is_binary(value) and value != "" -> put_session(conn, "sample_preset", value)
      _ -> conn
    end
  end
end
