defmodule Showcase.EvaluationContext do
  @moduledoc false

  @doc """
  Toggly evaluation map for LiveView and HTTP render.

  Named presets use the catalog fixtures. When preset is anonymous, prefer
  `toggly_context` stored on the session by `Showcase.PresetCookiePlug` from
  LiveE2E filter cookies (`toggly-identity`, `toggly-filter-*`).
  """
  def for_mount(preset, session, socket \\ nil) do
    preset = if is_binary(preset), do: preset, else: "anonymous"

    case preset do
      "matching" -> Showcase.Context.preset("matching")
      "nonmatching" -> Showcase.Context.preset("nonmatching")
      "anonymous" -> anonymous_context(session, socket)
      _ -> Showcase.Context.preset("anonymous")
    end
  end

  defp anonymous_context(session, socket) do
    session = session || %{}
    anon = Showcase.Context.preset("anonymous")
    session_ctx = session["toggly_context"] || session[:toggly_context]

    cond do
      is_map(session_ctx) and session_ctx != anon ->
        session_ctx

      socket != nil ->
        Showcase.FilterEvalCookies.context_from_connect(
          connect_cookies(socket),
          connect_headers(socket)
        ) || anon

      true ->
        anon
    end
  end

  defp connect_cookies(socket) do
    case socket.private[:connect_info] do
      %{cookies: cookies} when is_map(cookies) -> cookies
      %{"cookies" => cookies} when is_map(cookies) -> cookies
      _ -> %{}
    end
  end

  defp connect_headers(socket) do
    case Phoenix.LiveView.get_connect_info(socket, :x_headers) do
      headers when is_list(headers) -> headers
      _ -> []
    end
  rescue
    RuntimeError -> []
  end
end
