defmodule Showcase.LiveE2eDiagPlug do
  @moduledoc false
  # LIVEE2E_DIAG_REMOVE — temporary HTTP capture for ADO ui-static failures.
  import Plug.Conn

  @interest ~w(
    x-demo-preset x-toggly-preset x-toggly-identity
    x-forwarded-for x-forwarded-proto x-forwarded-host
    cookie user-agent accept-language cf-ipcountry
  )

  def init(opts), do: opts

  def call(conn, _opts) do
    conn = fetch_cookies(conn)

    capture = %{
      "method" => conn.method,
      "request_path" => conn.request_path,
      "query_string" => conn.query_string,
      "header_names" => Enum.map(conn.req_headers, &elem(&1, 0)) |> Enum.sort(),
      "headers" => header_map(conn),
      "cookie_names" => Map.keys(conn.req_cookies) |> Enum.sort(),
      "cookies" => cookie_values(conn.req_cookies),
      "session_keys" =>
        case conn.private[:plug_session] do
          map when is_map(map) -> Map.keys(map) |> Enum.sort()
          _ -> []
        end,
      "session_sample_preset" => session_value(conn, "sample_preset"),
      "session_toggly_identity" => session_identity(conn),
      "plug_preset" => conn.private[:showcase_preset_capture]
    }

    put_session(conn, "livee2e_diag_http", capture)
  end

  defp header_map(conn) do
    Map.new(conn.req_headers, fn {k, v} ->
      key = String.downcase(k)
      value = if key in @interest, do: v, else: if(String.starts_with?(key, "x-forwarded-"), do: v, else: "")
      {key, value}
    end)
    |> Enum.reject(fn {_k, v} -> v == "" end)
    |> Map.new()
  end

  defp cookie_values(cookies) do
    for key <- ~w(sample-preset toggly-preset demo-identity), value = cookies[key], not is_nil(value) do
      {key, value}
    end
    |> Map.new()
  end

  defp session_value(conn, key) do
    case get_session(conn, key) do
      nil -> ""
      other -> inspect(other, limit: 120, printable_limit: 120)
    end
  rescue
    _ -> ""
  end

  defp session_identity(conn) do
    case get_session(conn, "toggly_context") do
      %{"identity" => id} -> id
      _ -> ""
    end
  rescue
    _ -> ""
  end
end
