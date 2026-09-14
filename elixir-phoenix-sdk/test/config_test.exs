defmodule Showcase.ConfigTest do
  use ExUnit.Case

  test "signature age environment parses positive, disabled and unset values" do
    for {raw, expected} <- [{nil, nil}, {"", nil}, {"60", 60}, {"0", 0}, {"-1", -1}] do
      with_age(raw, fn ->
        config = Config.Reader.read!("config/runtime.exs", env: :test)
        assert config[:toggly_showcase][:max_signature_age_seconds] == expected
      end)
    end
  end

  test "invalid age environment values fail configuration instead of disabling the limit" do
    for raw <- ["invalid", "60.5", "60 seconds", " ", "false"] do
      with_age(raw, fn ->
        assert_raise ArgumentError, ~r/TOGGLY_MAX_SIGNATURE_AGE_SECONDS/, fn ->
          Config.Reader.read!("config/runtime.exs", env: :test)
        end
      end)
    end
  end

  test "application forwards the runtime signature age setting to its supervised client" do
    configured = Application.fetch_env!(:toggly_showcase, :max_signature_age_seconds)

    assert Keyword.fetch!(:sys.get_state(Showcase.Flags).opts, :max_signature_age_seconds) ==
             configured
  end

  test "snapshot path environment enables host-owned persistence" do
    original = System.get_env("TOGGLY_SNAPSHOT_PATH")
    System.put_env("TOGGLY_SNAPSHOT_PATH", "/tmp/toggly-offline.json")

    try do
      config = Config.Reader.read!("config/runtime.exs", env: :test)
      assert config[:toggly_showcase][:snapshot_path] == "/tmp/toggly-offline.json"
    after
      if original do
        System.put_env("TOGGLY_SNAPSHOT_PATH", original)
      else
        System.delete_env("TOGGLY_SNAPSHOT_PATH")
      end
    end
  end

  defp with_age(value, callback) do
    original = System.get_env("TOGGLY_MAX_SIGNATURE_AGE_SECONDS")
    put_age(value)

    try do
      callback.()
    after
      put_age(original)
    end
  end

  defp put_age(nil), do: System.delete_env("TOGGLY_MAX_SIGNATURE_AGE_SECONDS")
  defp put_age(value), do: System.put_env("TOGGLY_MAX_SIGNATURE_AGE_SECONDS", value)
end
