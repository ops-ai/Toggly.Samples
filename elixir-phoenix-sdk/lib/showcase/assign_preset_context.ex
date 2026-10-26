defmodule Showcase.AssignPresetContext do
  @moduledoc false
  import Phoenix.Component, only: [assign: 2]
  import Phoenix.LiveView, only: [attach_hook: 4, connected?: 1]

  @doc """
  Resolves the LiveE2E harness preset before `Toggly.LiveView` on_mount.

  The Toggly hook runs on static render and again when the socket connects. Without
  trusted `toggly_context` on the socket (or session), the connected pass re-evaluates
  flags as anonymous and the filter matrix flips OFF after hydration.
  """
  def on_mount(_default, params, session, socket) do
    preset = Showcase.Live.resolve_preset(params, session, socket)
    context = Showcase.Context.preset(preset)
    keys = socket.assigns.toggly_keys

    socket =
      assign(socket,
        preset: preset,
        toggly_context: context
      )

    socket =
      Toggly.LiveView.assign_feature_flags(socket, Showcase.Flags, keys, context: context)

    socket =
      if connected?(socket) do
        attach_hook(socket, :preset_toggly_refresh, :handle_info, &refresh_flags_with_preset/2)
      else
        socket
      end

    if diag_enabled?() do
      targeting =
        Map.get(socket.assigns.toggly_flags || %{}, "filter-targeting")

      IO.warn(
        "[toggly-livee2e-diag:liveview] " <>
          Jason.encode!(%{
            connected: connected?(socket),
            preset: preset,
            identity: context["identity"],
            filter_targeting: targeting,
            app_key_present: app_key_present?(),
            app_key_length: app_key_length()
          })
      )
    end

    {:cont, socket}
  end

  defp diag_enabled? do
    System.get_env("TOGGLY_LIVEE2E_DIAG") in ["1", "true"] or
      System.get_env("LIVEE2E_DIAG") in ["1", "true"]
  end

  defp app_key_present? do
    case Application.get_env(:toggly_showcase, :app_key) do
      key when is_binary(key) and key != "" and key != "ci-placeholder" -> true
      _ -> false
    end
  end

  defp app_key_length do
    case Application.get_env(:toggly_showcase, :app_key) do
      key when is_binary(key) -> byte_size(key)
      _ -> 0
    end
  end

  defp refresh_flags_with_preset({:toggly_updated, Showcase.Flags, _}, socket) do
    preset = Map.get(socket.assigns, :preset, "anonymous")
    context = Showcase.Context.preset(preset)

    {:halt,
     Toggly.LiveView.assign_feature_flags(socket, Showcase.Flags, socket.assigns.toggly_keys,
       context: context
     )}
  end

  defp refresh_flags_with_preset(_message, socket), do: {:cont, socket}
end
