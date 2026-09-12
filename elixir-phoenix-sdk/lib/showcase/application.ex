defmodule Showcase.Application do
  use Application
  @impl true
  def start(_, _) do
    offline = Application.fetch_env!(:toggly_showcase, :offline)
    # One supervised client owns definitions, never a user's identity. Missing
    # configuration selects a visible local fixture mode; it is not live proof.
    options = [
      name: Showcase.Flags,
      app_key: Application.get_env(:toggly_showcase, :app_key),
      environment: Application.fetch_env!(:toggly_showcase, :environment),
      defaults: %{
        "new-dashboard" => false,
        "api-v2" => false,
        "enhanced-submit" => false,
        "beta-access" => false
      },
      signed: not offline,
      websocket: not offline,
      refresh_interval: if(offline, do: 0, else: 60_000)
    ]

    options =
      if offline,
        do:
          Keyword.put(
            options,
            :snapshot_path,
            Application.app_dir(:toggly_showcase, "priv/offline-definitions.json")
          ),
        else: options

    Supervisor.start_link(
      [{Phoenix.PubSub, name: Showcase.PubSub}, {Toggly, options}, Showcase.Endpoint],
      strategy: :one_for_one,
      name: Showcase.Supervisor
    )
  end
end
