defmodule Showcase.FilterEvalCookies do
  @moduledoc false
  import Plug.Conn, only: [fetch_cookies: 1, get_req_header: 2]

  @claims_cookie "toggly-filter-claims"
  @country_cookie "toggly-filter-country"
  @ua_cookie "toggly-filter-ua"
  @lang_cookie "toggly-filter-lang"
  @vip_cookie "toggly-filter-vip"
  @identity_cookie "toggly-identity"

  @matching_ua "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  @nonmatching_ua "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"

  @doc "Build evaluation context from HTTP cookies (LiveE2E filters-matching fingerprint)."
  def context_from_conn(%Plug.Conn{} = conn) do
    conn = fetch_cookies(conn)
    context_from_bag(conn.req_cookies, header_identity(conn))
  end

  @doc "Build evaluation context from cookie map and optional x-toggly-identity header."
  def context_from_bag(cookies, identity_header \\ nil) when is_map(cookies) do
    bag = read_bag(cookies, identity_header)

    if meaningful?(bag) do
      build_context(bag)
    end
  end

  @doc "Build evaluation context from LiveView connect_info cookies and x_headers."
  def context_from_connect(cookies, headers) when is_map(cookies) do
    context_from_bag(cookies, header_from_list(headers, "x-toggly-identity"))
  end

  defp header_identity(conn) do
    case get_req_header(conn, "x-toggly-identity") do
      [value | _] when is_binary(value) and value != "" -> value
      _ -> nil
    end
  end

  defp header_from_list(headers, name) when is_list(headers) do
    down = String.downcase(name)

    Enum.find_value(headers, fn
      {key, value} when is_binary(key) and is_binary(value) ->
        if String.downcase(key) == down and String.trim(value) != "", do: String.trim(value)

      _ ->
        nil
    end)
  end

  defp read_bag(cookies, identity_header) do
    identity =
      non_empty(identity_header) ||
        cookie_value(cookies[@identity_cookie]) ||
        cookie_value(cookies["demo-identity"])

    %{
      identity: identity,
      claims_preset: parse_claims(cookie_value(cookies[@claims_cookie])),
      country: cookie_value(cookies[@country_cookie]),
      user_agent: cookie_value(cookies[@ua_cookie]),
      accept_language: cookie_value(cookies[@lang_cookie]),
      vip: parse_vip(cookie_value(cookies[@vip_cookie]))
    }
  end

  defp meaningful?(%{identity: id}) when is_binary(id) and id != "", do: true

  defp meaningful?(bag) do
    bag.claims_preset != :none or bag.country != nil or bag.user_agent != nil or
      bag.accept_language != nil or bag.vip != nil
  end

  defp build_context(bag) do
    vip? =
      case bag.vip do
        true -> true
        false -> false
        nil -> true
      end

    entity =
      if vip? do
        %{
          "kind" => "Order",
          "key" => "ord-vip",
          "attributes" => %{"Vip" => true, "Total" => 120}
        }
      else
        %{
          "kind" => "Order",
          "key" => "ord-standard",
          "attributes" => %{"Vip" => false, "Total" => 120}
        }
      end

    %{
      "identity" => bag.identity || "",
      "groups" => [],
      "claims" => claims_from_preset(bag.claims_preset),
      "request" => %{
        "country" => (bag.country || "") |> String.upcase(),
        "acceptLanguage" => bag.accept_language || "",
        "userAgent" => bag.user_agent || default_user_agent(bag.identity)
      },
      "entity" => entity
    }
  end

  defp default_user_agent("bob"), do: @nonmatching_ua
  defp default_user_agent(_), do: @matching_ua

  defp claims_from_preset(:admin), do: %{"role" => "admin"}
  defp claims_from_preset(:user), do: %{"role" => "user"}
  defp claims_from_preset(:none), do: %{"role" => "user"}

  defp parse_claims("admin"), do: :admin
  defp parse_claims("user"), do: :user
  defp parse_claims(_), do: :none

  defp parse_vip(nil), do: nil

  defp parse_vip(value) when is_binary(value) do
    case String.downcase(String.trim(value)) do
      "1" -> true
      "true" -> true
      "0" -> false
      "false" -> false
      _ -> nil
    end
  end

  defp non_empty(nil), do: nil

  defp non_empty(value) when is_binary(value) do
    trimmed = String.trim(value)
    if trimmed == "", do: nil, else: trimmed
  end

  defp non_empty(_), do: nil

  defp cookie_value(value) when is_binary(value) do
    trimmed = String.trim(value)

    if trimmed == "" do
      nil
    else
      try do
        case URI.decode(trimmed) do
          decoded when is_binary(decoded) and decoded != "" -> decoded
          _ -> trimmed
        end
      rescue
        ArgumentError -> trimmed
      end
    end
  end

  defp cookie_value(_), do: nil
end
