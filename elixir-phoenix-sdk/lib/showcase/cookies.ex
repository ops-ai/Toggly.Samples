defmodule Showcase.Cookies do
  @moduledoc false

  import Phoenix.LiveView, only: [get_connect_info: 2]

  def parse_header(nil), do: %{}
  def parse_header(""), do: %{}

  def parse_header(header) when is_binary(header) do
    header
    |> String.split(";", trim: true)
    |> Enum.reduce(%{}, fn pair, acc ->
      case String.split(pair, "=", parts: 2) do
        [key, value] ->
          key = String.trim(key)
          value = URI.decode_www_form(String.trim(value))
          Map.put(acc, key, value)

        _ ->
          acc
      end
    end)
  end

  def preset_from_socket(socket) do
    cookies = cookies_from_connect_info(socket)

    case cookies do
      %{"sample-preset" => value} when is_binary(value) and value != "" -> value
      %{"toggly-preset" => value} when is_binary(value) and value != "" -> value
      _ -> nil
    end
  end

  defp cookies_from_connect_info(socket) do
    case get_connect_info(socket, :x_headers) do
      headers when is_list(headers) ->
        Enum.find_value(headers, %{}, fn
          {"cookie", value} -> parse_header(value)
          {"Cookie", value} -> parse_header(value)
          _ -> nil
        end)

      _ ->
        %{}
    end
  end
end
