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
end
