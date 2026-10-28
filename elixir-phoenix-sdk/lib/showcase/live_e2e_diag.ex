defmodule Showcase.LiveE2eDiag do
  @moduledoc false
  # LIVEE2E_DIAG_REMOVE — inline HTML diagnostics for ADO pack-ui row text.

  import Phoenix.LiveView, only: [connected?: 1]

  @harness_note "harness_expected(fingerprint=matching ui-static): per toggly.samples elixir scripts/astro parity — browserContext.extraHTTPHeaders[x-demo-preset]=matching AND cookie sample-preset=matching before goto / (no ?preset=); astro also honors x-toggly-identity=alice when preset absent; pack-ui source not in repo (404) — confirm from ADO row below"

  def assign_diag(socket, params, session) do
    Phoenix.Component.assign(socket, :livee2e_diag_line, build_line(socket, params, session))
  end

  def build_line(socket, params, session) do
    preset = Map.get(socket.assigns, :preset, "?")
    context = Map.get(socket.assigns, :toggly_context, %{})
    identity = Map.get(context, "identity", "")
    flag_on = Map.get(socket.assigns, :toggly_flags, %{})["filter-targeting"]
    direct = Toggly.enabled?(Showcase.Flags, "filter-targeting", context)
    data = safe_data()
    definition = Map.get(data.definitions, "filter-targeting")
    filter_meta = definition_filters(definition)

    pieces = [
      "LIVEE2E_DIAG_REMOVE",
      "lv_connected=#{connected?(socket)}",
      "preset=#{preset}",
      "identity=#{identity}",
      "assign_flag=#{flag_on}",
      "eval_enabled=#{direct}",
      "defs_count=#{map_size(data.definitions)}",
      "defs_source=#{data.source}",
      "defs_revision=#{data.revision}",
      "filter_targeting=#{filter_meta}",
      "context_entity=#{entity_summary(context)}",
      "params=#{compact(params)}",
      "session_keys=#{session_keys(session)}",
      "session_sample_preset=#{session_val(session, "sample_preset")}",
      "session_toggly_context=#{compact(Map.get(session, "toggly_context"))}",
      "http=#{compact(Map.get(session, "livee2e_diag_http"))}",
      "connect_uri=#{connect_uri(socket)}",
      "connect_peer=#{connect_peer(socket)}",
      "connect_x_headers=#{connect_x_headers(socket)}",
      @harness_note
    ]

    Enum.join(pieces, " | ")
  end

  defp safe_data do
    try do
      Toggly.data(Showcase.Flags)
    rescue
      _ -> %{definitions: %{}, source: :error, revision: nil, timestamp: nil, defaults: %{}}
    end
  end

  defp definition_filters(nil), do: "missing"

  defp definition_filters(definition) when is_map(definition) do
    filters = Map.get(definition, "filters") || Map.get(definition, :filters) || []

    Enum.map_join(filters, ";", fn filter ->
      name = Map.get(filter, "name") || Map.get(filter, :name) || "?"
      params = Map.get(filter, "parameters") || Map.get(filter, :parameters) || %{}
      users = Map.get(params, "Audience.Users:0") || Map.get(params, "Users:0") || ""

      rollout =
        Map.get(params, "Audience.DefaultRolloutPercentage") ||
          Map.get(params, "DefaultRolloutPercentage") || ""

      "name=#{name} users0=#{users} rollout=#{rollout}"
    end)
  end

  defp definition_filters(_), do: "unknown"

  defp entity_summary(%{"entity" => entity}) when is_map(entity) do
    key = Map.get(entity, "key", "")
    vip = get_in(entity, ["attributes", "Vip"])
    "key=#{key} vip=#{vip}"
  end

  defp entity_summary(_), do: ""

  defp session_keys(session) when is_map(session),
    do: Enum.join(Map.keys(session) |> Enum.sort(), ",")

  defp session_keys(_), do: ""

  defp session_val(session, key) when is_map(session) do
    case Map.get(session, key) do
      nil -> ""
      value -> compact(value)
    end
  end

  defp compact(value) do
    inspect(value, limit: 8, printable_limit: 512, width: 10_000)
    |> String.replace("\n", " ")
  end

  defp connect_uri(socket) do
    case connect_info(socket, :uri) do
      %URI{} = uri -> URI.to_string(uri)
      _ -> ""
    end
  end

  defp connect_peer(socket) do
    case connect_info(socket, :peer_data) do
      %{address: addr, port: port} -> "#{inspect(addr)}:#{port}"
      other when not is_nil(other) -> compact(other)
      _ -> ""
    end
  end

  defp connect_x_headers(socket) do
    case connect_info(socket, :x_headers) do
      headers when is_list(headers) -> compact(headers)
      _ -> ""
    end
  end

  defp connect_info(socket, key) do
    try do
      Phoenix.LiveView.get_connect_info(socket, key)
    rescue
      RuntimeError -> nil
    end
  end
end
