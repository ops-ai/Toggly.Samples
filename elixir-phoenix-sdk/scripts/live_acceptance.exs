defmodule Showcase.LiveAcceptance do
  @moduledoc false
  @keys ["new-dashboard", "api-v2", "enhanced-submit", "beta-access", "ExpressCheckout"]

  def options(env) do
    key = env["TOGGLY_APP_KEY"]
    path = env["TOGGLY_SNAPSHOT_PATH"]

    if is_binary(key) and String.trim(key) != "" and is_binary(path) and
         Path.type(path) == :absolute do
      {:ok,
       [
         name: Showcase.Flags,
         app_key: key,
         environment: env["TOGGLY_ENVIRONMENT"] || "Production",
         base_url: "https://definitions.toggly.io",
         snapshot_path: path,
         signed: true,
         max_signature_age_seconds: age(env["TOGGLY_MAX_SIGNATURE_AGE_SECONDS"]),
         websocket: true,
         refresh_interval: 0,
         flush_interval: 0,
         usage: false,
         defaults: Map.new(@keys, &{&1, false})
       ]}
    else
      {:error, :configuration}
    end
  end

  def main(mode) do
    # Transport exceptions can contain credential-bearing URLs. This diagnostic
    # process reports only allowlisted events; an error still exits unsuccessfully.
    Logger.configure(level: :emergency)

    try do
      {:ok, opts} =
        options(
          Map.new(
            ~w(TOGGLY_APP_KEY TOGGLY_ENVIRONMENT TOGGLY_SNAPSHOT_PATH TOGGLY_MAX_SIGNATURE_AGE_SECONDS),
            &{&1, System.get_env(&1)}
          )
        )

      Enum.each([:toggly, :toggly_phoenix, :toggly_live_view, :bandit], fn app ->
        {:ok, _} = Application.ensure_all_started(app)
      end)

      case mode do
        "serve" -> serve(opts)
        "cold" -> cold(opts)
        _ -> throw(:configuration)
      end
    rescue
      _ -> failed()
    catch
      _, _ -> failed()
    end
  end

  defp serve(opts) do
    Application.put_env(:toggly_showcase, :offline, false)
    endpoint = Application.fetch_env!(:toggly_showcase, Showcase.Endpoint)
    Application.put_env(:toggly_showcase, Showcase.Endpoint, Keyword.put(endpoint, :server, true))

    {:ok, sup} =
      Supervisor.start_link(
        [{Phoenix.PubSub, name: Showcase.PubSub}, {Toggly, opts}, Showcase.Endpoint],
        strategy: :one_for_one
      )

    try do
      :ok = Toggly.subscribe(Showcase.Flags)
      :ok = Toggly.refresh(Showcase.Flags)
      %{source: :remote} = Toggly.snapshot(Showcase.Flags)
      emit(metadata(opts, "ready"))
      owner = self()
      reader = spawn(fn -> send(owner, {:input, IO.gets("")}) end)

      try do
        deadline = System.monotonic_time(:millisecond) + timeout()
        observe(opts, deadline)
      after
        Process.exit(reader, :kill)
      end
    after
      Supervisor.stop(sup)
    end
  end

  defp observe(opts, deadline) do
    remaining = max(0, deadline - System.monotonic_time(:millisecond))

    receive do
      {:toggly_updated, Showcase.Flags, _} ->
        emit(metadata(opts, "update"))
        observe(opts, deadline)

      {:input, "stop\n"} ->
        emit(%{stage: "stopped"})

      {:input, _} ->
        throw(:invalid_stop)
    after
      remaining -> throw(:timeout)
    end
  end

  defp cold(opts) do
    expected = System.fetch_env!("TOGGLY_ACCEPTANCE_EXPECTED_TIMESTAMP") |> String.to_integer()
    expected_hash = System.fetch_env!("TOGGLY_ACCEPTANCE_EXPECTED_SNAPSHOT_SHA256")
    true = expected > 0 and expected_hash == file_hash(opts[:snapshot_path])
    {:ok, requests} = Agent.start_link(fn -> 0 end)

    deny = fn _ ->
      Agent.update(requests, &(&1 + 1))
      {:error, :offline}
    end

    {:ok, sup} = Toggly.start_link(Keyword.merge(opts, websocket: false, transport: deny))

    try do
      before = Toggly.snapshot(Showcase.Flags)
      %{source: :snapshot, timestamp: ^expected} = before
      0 = Agent.get(requests, & &1)
      {:error, :offline} = Toggly.refresh(Showcase.Flags)
      ^before = Toggly.snapshot(Showcase.Flags)
      1 = Agent.get(requests, & &1)
      result = metadata(opts, "cold_verified")
      ^expected_hash = result.snapshot_sha256
      emit(Map.put(result, :denied_requests, 1))
    after
      Toggly.stop(sup)
      Agent.stop(requests)
    end
  end

  defp metadata(opts, stage) do
    snapshot = Toggly.snapshot(Showcase.Flags)
    {:ok, saved} = Toggly.Snapshot.read(opts[:snapshot_path])
    envelope = Jason.decode!(saved) |> Map.fetch!("envelope") |> Jason.decode!()
    timestamp = snapshot.timestamp
    ^timestamp = envelope["timestamp"]
    # Revisions and persisted bytes are represented by hashes, never raw values.
    %{
      stage: stage,
      source: snapshot.source,
      timestamp: timestamp,
      revision_sha256: hash(to_string(snapshot.revision)),
      snapshot_sha256: hash(saved),
      kid_sha256: hash(envelope["kid"]),
      alice: decisions("matching"),
      bob: decisions("nonmatching")
    }
  end

  defp decisions(mode),
    do: Toggly.snapshot(Showcase.Flags, Showcase.Context.preset(mode)).flags |> Map.take(@keys)

  defp file_hash(path), do: File.read!(path) |> hash()
  defp hash(value), do: :crypto.hash(:sha256, value) |> Base.encode16(case: :lower)

  defp age(value) when value in [nil, ""], do: nil
  defp age(value), do: String.to_integer(value)

  defp timeout do
    value = System.get_env("TOGGLY_ACCEPTANCE_TIMEOUT_MS", "300000") |> String.to_integer()
    true = value in 1000..3_600_000
    value
  end

  defp emit(event), do: IO.puts(Jason.encode!(event))

  defp failed do
    emit(%{stage: "failed", reason: "configuration_or_acceptance_check"})
    System.halt(1)
  end
end

case System.argv() do
  ["--acceptance", mode] -> Showcase.LiveAcceptance.main(mode)
  _ -> :ok
end
