defmodule Showcase.PresetResolution do
  @moduledoc false

  @doc """
  Resolves the harness preset and preserves a non-anonymous preset already on the
  socket when LiveView reconnects without session/header context (Live E2E fingerprint).
  """
  def resolve(params, session, socket) do
    Showcase.Live.resolve_preset(params, session, socket)
    |> preserve_socket_preset(socket)
  end

  defp preserve_socket_preset("anonymous", socket) do
    case Map.get(socket.assigns, :preset) do
      preset when preset in ["matching", "nonmatching"] -> preset
      _ -> "anonymous"
    end
  end

  defp preserve_socket_preset(preset, _socket), do: preset
end
