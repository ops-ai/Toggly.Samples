defmodule Showcase.FilterEvalCookiesTest do
  use ExUnit.Case, async: true

  test "builds alice matching context from ADO-style cookies" do
    cookies = %{
      "toggly-identity" => "alice",
      "toggly-filter-claims" => "admin",
      "toggly-filter-country" => "US",
      "toggly-filter-vip" => "1"
    }

    ctx = Showcase.FilterEvalCookies.context_from_bag(cookies)
    assert ctx["identity"] == "alice"
    assert get_in(ctx, ["claims", "role"]) == "admin"
    assert get_in(ctx, ["entity", "key"]) == "ord-vip"
  end

  test "ignores empty cookie bag" do
    refute Showcase.FilterEvalCookies.context_from_bag(%{})
  end

  test "decodes percent-encoded accept-language cookie values" do
    ctx =
      Showcase.FilterEvalCookies.context_from_bag(%{
        "toggly-identity" => "alice",
        "toggly-filter-lang" => "en-US%2Cen%3Bq%3D0.9"
      })

    assert get_in(ctx, ["request", "acceptLanguage"]) == "en-US,en;q=0.9"
  end
end
