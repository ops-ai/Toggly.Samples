defmodule Showcase.AssignPresetContext do
  @moduledoc false
  import Phoenix.Component, only: [assign: 2]

  @doc """
  Resolves the LiveE2E harness preset before `Toggly.LiveView` on_mount.

  The Toggly hook runs on static render and again when the socket connects. Without
  trusted `toggly_context` on the socket (or session), the connected pass re-evaluates
  flags as anonymous and the filter matrix flips OFF after hydration.
  """
  def on_mount(_default, params, session, socket) do
    preset = Showcase.Live.resolve_preset(params, session, socket)
    context = Showcase.Context.preset(preset)

    {:cont,
     assign(socket,
       preset: preset,
       toggly_context: context
     )}
  end
end
