defmodule TogglyShowcase.MixProject do
  use Mix.Project

  def project do
    [
      app: :toggly_showcase,
      version: "0.1.0",
      elixir: "~> 1.20",
      deps: [
        {:toggly, "~> 0.1.0"},
        {:toggly_phoenix, "~> 0.1.0"},
        {:toggly_live_view, "~> 0.1.0"},
        {:phoenix, "~> 1.8"},
        {:phoenix_live_view, "~> 1.2"},
        {:phoenix_html, "~> 4.3"},
        {:bandit, "~> 1.8"},
        {:jason, "~> 1.4"},
        {:lazy_html, ">= 0.1.0", only: :test}
      ],
      aliases: [
        setup: ["deps.get", "assets.build"],
        "assets.build": ["run --no-start scripts/build_assets.exs"]
      ]
    ]
  end

  def application,
    do: [mod: {Showcase.Application, []}, extra_applications: [:logger, :runtime_tools]]
end
