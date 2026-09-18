key = System.get_env("TOGGLY_APP_KEY")

if key in [nil, "", "ci-placeholder"] do
  IO.puts("soak skipped: no live TOGGLY_APP_KEY")
else
  refresh = String.to_integer(System.get_env("TOGGLY_REFRESH_INTERVAL_MS", "5000"))
  flush = String.to_integer(System.get_env("TOGGLY_FLUSH_INTERVAL_MS", "5000"))
  wait = refresh + flush + 10_000

  env = [
    {"TOGGLY_APP_KEY", key},
    {"TOGGLY_ENVIRONMENT", System.get_env("TOGGLY_ENVIRONMENT", "Production")},
    {"TOGGLY_REFRESH_INTERVAL_MS", Integer.to_string(refresh)},
    {"TOGGLY_FLUSH_INTERVAL_MS", Integer.to_string(flush)},
    {"PORT", System.get_env("PORT", "0")}
  ]

  port =
    Port.open({:spawn_executable, System.find_executable("mix")}, [
      :exit_status,
      :hide,
      args: ["phx.server"],
      env: Enum.map(env, fn {k, v} -> {String.to_charlist(k), String.to_charlist(v)} end),
      cd: File.cwd!()
    ])

  Process.sleep(wait)

  IO.puts(
    "soak complete: waited #{wait}ms (refresh #{refresh}ms + flush #{flush}ms + slack 10000ms)"
  )

  case Port.info(port, :os_pid) do
    {:os_pid, os_pid} -> System.cmd("kill", ["-TERM", Integer.to_string(os_pid)])
    _ -> :ok
  end
end
