defmodule Showcase.PresetResolution do
  @moduledoc false

  @doc """
  Resolves the harness preset for static and connected LiveView mounts.

  Connected WebSocket mounts start with empty `socket.assigns`; preset and identity
  must come from the signed session (set by `Showcase.PresetCookiePlug` on the HTTP
  GET), connect_info headers/cookies, or query on the upgrade URI.
  """
  def resolve(params, session, socket) do
    session = merge_connect_session(session, socket)
    Showcase.Live.resolve_preset(params, session, socket)
  end

  defp merge_connect_session(session, socket) when is_map(session) do
    case connect_session(socket) do
      extra when is_map(extra) and extra != %{} -> Map.merge(extra, session)
      _ -> session
    end
  end

  defp connect_session(%Phoenix.LiveView.Socket{private: %{connect_info: %Plug.Conn{} = conn}}) do
    case conn.private[:plug_session] do
      plug_session when is_map(plug_session) -> plug_session
      _ -> %{}
    end
  end

  defp connect_session(%Phoenix.LiveView.Socket{private: %{connect_info: info}})
       when is_map(info) do
    info[:session] || info["session"] || %{}
  end

  defp connect_session(_), do: %{}
end
