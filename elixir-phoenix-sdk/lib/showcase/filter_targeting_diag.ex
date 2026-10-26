defmodule Showcase.FilterTargetingDiag do
  @moduledoc false
  # TEMPORARY Live E2E diagnostics — remove after filter-targeting root cause is found.

  @env_prefix ~r/^(TOGGLY_|LIVEE2E_|SAMPLE_|PORT|HOST|SECRET_)/

  def build(preset, context) when is_map(context) do
    data = Toggly.data(Showcase.Flags)
    definition = Map.get(data.definitions, "filter-targeting")
    eval = Toggly.enabled?(Showcase.Flags, "filter-targeting", context)

    Jason.encode!(%{
      temp: "LIVEE2E_DIAG_REMOVE",
      preset: preset,
      identity: Map.get(context, "identity"),
      role: get_in(context, ["claims", "role"]),
      eval: eval,
      source: data.source,
      revision: data.revision,
      definition_count: map_size(data.definitions),
      has_filter_targeting: definition != nil,
      targeting_filter: targeting_filter_name(definition),
      targeting_rollout: targeting_rollout(definition),
      targeting_user_slots: targeting_user_slots(definition),
      runtime_app_key_len: app_key_length(),
      offline: Application.fetch_env!(:toggly_showcase, :offline),
      env: env_lengths()
    })
  end

  defp env_lengths do
    System.get_env()
    |> Enum.filter(fn {key, _} -> String.match?(key, @env_prefix) end)
    |> Enum.map(fn {key, value} -> %{n: key, l: byte_size(value || "")} end)
    |> Enum.sort_by(& &1.n)
  end

  defp app_key_length do
    case Application.get_env(:toggly_showcase, :app_key) do
      key when is_binary(key) -> byte_size(key)
      _ -> 0
    end
  end

  defp targeting_filter_name(nil), do: nil

  defp targeting_filter_name(definition) do
    definition
    |> Map.get("filters", [])
    |> Enum.find(fn filter ->
      name = filter["name"] || ""
      String.replace_prefix(name, "Microsoft.", "") == "Targeting"
    end)
    |> case do
      %{"name" => name} -> name
      _ -> nil
    end
  end

  defp targeting_rollout(nil), do: nil

  defp targeting_rollout(definition) do
    params =
      definition
      |> Map.get("filters", [])
      |> Enum.find(fn filter ->
        name = filter["name"] || ""
        String.replace_prefix(name, "Microsoft.", "") == "Targeting"
      end)
      |> then(&(&1 && Map.get(&1, "parameters", %{})))

    params["Audience.DefaultRolloutPercentage"] ||
      params["Audience:DefaultRolloutPercentage"] ||
      params["Percentage"]
  end

  defp targeting_user_slots(nil), do: 0

  defp targeting_user_slots(definition) do
    params =
      definition
      |> Map.get("filters", [])
      |> Enum.find(fn filter ->
        name = filter["name"] || ""
        String.replace_prefix(name, "Microsoft.", "") == "Targeting"
      end)
      |> then(&(&1 && Map.get(&1, "parameters", %{})))

    params
    |> Map.keys()
    |> Enum.count(fn key ->
      String.starts_with?(key, "Audience.Users") or String.starts_with?(key, "Audience:Users")
    end)
  end
end
