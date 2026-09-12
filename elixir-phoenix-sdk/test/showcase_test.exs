defmodule ShowcaseTest do
  use ExUnit.Case
  import Phoenix.ConnTest
  import Phoenix.LiveViewTest
  @endpoint Showcase.Endpoint
  test "full showcase sections, offline banner and server mutation gate" do
    {:ok, view, html} = live(build_conn(), "/")

    for id <- ~w(home declarative api identity entity filters phoenix missing-key),
        do: assert(html =~ ~s(id="#{id}"))

    assert has_element?(view, "#new-dashboard")
    refute has_element?(view, "#classic-dashboard")
    assert has_element?(view, "#all-enabled")
    refute has_element?(view, "#all-disabled")
    assert has_element?(view, "#any-enabled")
    refute has_element?(view, "#any-disabled")
    assert render_click(view, "submit") =~ "Enhanced submission accepted"
    assert render_click(view, "refresh") =~ "missing_app_key"
    assert get(build_conn(), "/protected").status == 200
  end

  test "separate sessions, matching/nonmatching filters and Order.Vip" do
    {:ok, alice, _} = live(build_conn(), "/")
    {:ok, bob, _} = live(build_conn(), "/")
    render_click(bob, "preset", %{"mode" => "nonmatching"})
    assert has_element?(alice, "#current-identity", "alice")
    assert has_element?(bob, "#current-identity", "bob")

    for key <-
          ~w(filter-targeting filter-user-claims filter-country filter-browser-family filter-browser-language filter-device-type filter-os filter-context-property) do
      assert has_element?(alice, "##{key}", "ON"), key
      assert has_element?(bob, "##{key}", "OFF"), key
    end

    assert has_element?(alice, "#express-result", "ExpressCheckout available")
    assert has_element?(bob, "#express-result", "Standard checkout")
    refute has_element?(alice, "#express-result", "Standard checkout")
    refute has_element?(bob, "#express-result", "ExpressCheckout available")

    render_click(bob, "preset", %{"mode" => "matching"})
    assert has_element?(bob, "#express-result", "ExpressCheckout available")
    refute has_element?(bob, "#express-result", "Standard checkout")
    assert has_element?(alice, "#current-identity", "alice")
  end
end
