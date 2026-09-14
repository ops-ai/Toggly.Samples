path = Path.expand("../scripts/live_acceptance.exs", __DIR__)
if File.exists?(path), do: Code.require_file(path)

defmodule Showcase.LiveAcceptanceTest do
  use ExUnit.Case, async: false

  test "requires environment inputs and pins signed public non-polling configuration" do
    assert {:error, :configuration} = Showcase.LiveAcceptance.options(%{})

    assert {:error, :configuration} =
             Showcase.LiveAcceptance.options(%{
               "TOGGLY_APP_KEY" => "fixture",
               "TOGGLY_SNAPSHOT_PATH" => "relative"
             })

    assert {:ok, opts} = Showcase.LiveAcceptance.options(env("/tmp/fixture-snapshot"))
    assert opts[:signed] and opts[:websocket]
    assert opts[:refresh_interval] == 0 and opts[:flush_interval] == 0
    assert opts[:usage] == false
    assert opts[:base_url] == "https://definitions.toggly.io"
  end

  test "fresh process restores a genuinely signed local fixture with denied transport" do
    path = Path.join(System.tmp_dir!(), "acceptance-#{System.unique_integer([:positive])}.json")
    on_exit(fn -> File.rm(path) end)
    {:ok, opts} = Showcase.LiveAcceptance.options(env(path))
    {body, jwks} = signed()

    transport = fn req ->
      {:ok,
       %{
         status: 200,
         headers: [],
         body: if(String.ends_with?(req.url, "jwks"), do: Jason.encode!(jwks), else: body)
       }}
    end

    {:ok, sup} =
      Toggly.start_link(
        Keyword.merge(opts, name: AcceptanceFixture, websocket: false, transport: transport)
      )

    assert :ok = Toggly.refresh(AcceptanceFixture)
    Toggly.stop(sup)

    {output, status} = cold_process(with_hash(env(path), path))
    assert status == 0, output
    assert output =~ ~s("stage":"cold_verified")
    assert output =~ ~s("source":"snapshot")
    assert output =~ ~s("denied_requests":1)
    refute output =~ "fixture-private-key"
    refute output =~ "definitions-signed/"

    {output, status} =
      cold_process(Map.put(with_hash(env(path), path), "TOGGLY_APP_KEY", "wrong-partition"))

    assert status != 0
    assert output =~ ~s("stage":"failed")
    File.write!(path, "corrupt")
    {_output, status} = cold_process(with_hash(env(path), path))
    assert status != 0
  end

  defp with_hash(env, path),
    do:
      Map.put(
        env,
        "TOGGLY_ACCEPTANCE_EXPECTED_SNAPSHOT_SHA256",
        Base.encode16(:crypto.hash(:sha256, File.read!(path)), case: :lower)
      )

  defp env(path),
    do: %{
      "TOGGLY_APP_KEY" => "fixture-private-key",
      "TOGGLY_SNAPSHOT_PATH" => path,
      "TOGGLY_ENVIRONMENT" => "Production",
      "TOGGLY_ACCEPTANCE_EXPECTED_TIMESTAMP" => "100",
      "TOGGLY_MAX_SIGNATURE_AGE_SECONDS" => ""
    }

  test "browser preflight rejects remote and credential-bearing URLs without echoing them" do
    script = "scripts/live-browser.mjs"

    base = [
      {"PLAYWRIGHT_MODULE_PATH", "/tmp/unused-driver.mjs"},
      {"TOGGLY_ACCEPTANCE_TIMEOUT_MS", "1000"}
    ]

    for {url, expected} <- [
          {"http://localhost:4000", 0},
          {"https://example.invalid", 1},
          {"http://fixture-secret@localhost:4000", 1}
        ] do
      {output, status} =
        System.cmd(System.find_executable("node"), [script, "--check"],
          env: [{"SAMPLE_URL", url} | base],
          stderr_to_stdout: true
        )

      assert status == expected
      refute output =~ "fixture-secret"
      refute output =~ url
    end
  end

  test "browser cleanup rejects and stalls stay private, bounded and terminate the owned child" do
    {output, status} =
      System.cmd(System.find_executable("node"), ["--test", "test/live_browser_cleanup_test.mjs"],
        stderr_to_stdout: true
      )

    assert status == 0, output
  end

  defp cold_process(env) do
    System.cmd(
      System.find_executable("mix"),
      ["run", "--no-start", "scripts/live_acceptance.exs", "--acceptance", "cold"],
      env: Map.to_list(env),
      stderr_to_stdout: true
    )
  end

  # Local cryptographic fixture: exercises the installed public SDK, not a live service.
  defp signed do
    raw = ~s([{"featureKey":"new-dashboard","filters":[{"name":"AlwaysOn"}]}])
    {public, private} = :crypto.generate_key(:ecdh, :secp256r1)
    <<4, x::binary-size(32), y::binary-size(32)>> = public
    kid = Base.encode16(:crypto.hash(:sha, x <> y)) <> "ES256"

    jwk = %{
      "kid" => kid,
      "alg" => "ES256",
      "kty" => "EC",
      "crv" => "P-256",
      "x" => Base.url_encode64(x, padding: false),
      "y" => Base.url_encode64(y, padding: false)
    }

    signature =
      :crypto.sign(:ecdsa, :sha256, :crypto.hash(:sha256, raw <> "|100"), [private, :secp256r1])

    {:"ECDSA-Sig-Value", r, s} = :public_key.der_decode(:"ECDSA-Sig-Value", signature)

    header =
      Jason.encode!(%{
        "kid" => kid,
        "timestamp" => 100,
        "signature" => Base.encode64(<<r::unsigned-256, s::unsigned-256>>)
      })

    {String.trim_trailing(header, "}") <> ",\"defs\":" <> raw <> "}", %{"keys" => [jwk]}}
  end
end
