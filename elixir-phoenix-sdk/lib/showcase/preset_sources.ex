defmodule Showcase.PresetSources do
  @moduledoc false
  import Plug.Conn, only: [fetch_cookies: 1, fetch_query_params: 1, get_req_header: 2]

  @doc "Resolve harness preset from an HTTP conn (plug pipeline)."
  def from_conn(conn) do
    conn = fetch_cookies(conn)
    conn = fetch_query_params(conn)

    resolve(
      conn.query_params,
      conn.req_cookies,
      headers(conn),
      Plug.Conn.get_session(conn)
    )
  end

  @doc "Resolve harness preset for LiveView mount (params, session, socket connect_info)."
  def for_live(params, session, socket) do
    {query_params, headers, cookies} = live_request_parts(params, socket)

    resolve(
      query_params,
      cookies,
      headers,
      session
    )
  end

  defp live_request_parts(params, socket) do
    params = merge_uri_query_params(params || %{}, socket)
    headers = connect_headers(socket)
    {params, headers, connect_cookies(socket)}
  end

  defp merge_uri_query_params(params, socket) do
    case connect_info(socket, :uri) do
      %URI{query: query} when is_binary(query) and query != "" ->
        Map.merge(URI.decode_query(query), params)

      _ ->
        params
    end
  end

  defp connect_headers(socket) do
    case connect_info(socket, :x_headers) do
      headers when is_list(headers) -> headers
      _ -> []
    end
  end

  defp connect_info(socket, key) do
    try do
      Phoenix.LiveView.get_connect_info(socket, key)
    rescue
      RuntimeError -> nil
    end
  end

  defp connect_cookies(socket) do
    case socket.private[:connect_info] do
      %{cookies: cookies} when is_map(cookies) -> cookies
      %{"cookies" => cookies} when is_map(cookies) -> cookies
      _ -> %{}
    end
  end

  defp headers(conn) when is_struct(conn, Plug.Conn) do
    for name <- ~w(x-demo-preset x-toggly-preset x-toggly-identity),
        value <- get_req_header(conn, name),
        value != "",
        do: {String.downcase(name), value}
  end

  defp headers(list) when is_list(list), do: list

  defp resolve(query_params, cookies, headers, session) when is_map(query_params) do
    explicit = Map.get(query_params, "preset")

    cond do
      explicit in [nil, "", "none"] ->
        harness_signals(query_params, cookies, headers, session)

      true ->
        normalize_preset(explicit)
    end
  end

  defp harness_signals(query_params, cookies, headers, session) do
    session_preset(session) ||
      preset_from_session_context(session) ||
      normalize_preset(Map.get(query_params, "fingerprint")) ||
      normalize_preset(Map.get(query_params, "identity")) ||
      header_preset(headers) ||
      cookie_preset(cookies) ||
      "anonymous"
  end

  defp session_preset(session) when is_map(session) do
    session["sample_preset"] || session[:sample_preset]
  end

  defp preset_from_session_context(%{"toggly_context" => %{"identity" => "alice"}}),
    do: "matching"

  defp preset_from_session_context(%{"toggly_context" => %{"identity" => "bob"}}),
    do: "nonmatching"

  defp preset_from_session_context(_), do: nil

  defp header_preset(headers) do
    Enum.find_value(headers, fn
      {"x-toggly-identity", "alice"} -> "matching"
      {"x-toggly-identity", "bob"} -> "nonmatching"
      {"x-demo-preset", value} -> normalize_preset(value)
      {"x-toggly-preset", value} -> normalize_preset(value)
      _ -> nil
    end)
  end

  defp cookie_preset(cookies) when is_map(cookies) do
    cookies["sample-preset"] ||
      cookies["toggly-preset"] ||
      identity_cookie(cookies["demo-identity"])
  end

  defp identity_cookie("alice"), do: "matching"
  defp identity_cookie("bob"), do: "nonmatching"
  defp identity_cookie(_), do: nil

  defp normalize_preset(value) when is_binary(value) do
    case String.downcase(String.trim(value)) do
      "" -> nil
      "matching" -> "matching"
      "nonmatching" -> "nonmatching"
      "non-matching" -> "nonmatching"
      "alice" -> "matching"
      "bob" -> "nonmatching"
      "anonymous" -> "anonymous"
      _ -> nil
    end
  end

  defp normalize_preset(_), do: nil
end
