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

  test "mount honors ?preset= on initial LiveView connect" do
    {:ok, view, _} = live(build_conn(), "/?preset=nonmatching")
    assert has_element?(view, "#current-identity", "bob")
    assert has_element?(view, "#filter-targeting", "OFF")
    assert has_element?(view, "#filter-context-property", "OFF")
  end

  test "mount without preset stays anonymous for targeting" do
    {:ok, view, _} = live(build_conn(), "/")
    assert has_element?(view, "#current-identity", "")
    assert has_element?(view, "#filter-targeting", "OFF")
  end

  test "mount reads sample-preset cookie when query omits preset" do
    conn =
      build_conn()
      |> Plug.Conn.put_req_header("cookie", "sample-preset=matching")
      |> init_test_session(%{})

    {:ok, view, _} = live(conn, "/")
    assert has_element?(view, "#filter-targeting", "ON")
  end

  test "refresh keeps harness preset targeting after toggly_updated" do
    conn =
      build_conn()
      |> Plug.Conn.put_req_header("x-demo-preset", "matching")
      |> init_test_session(%{})

    {:ok, view, _} = live(conn, "/")
    assert has_element?(view, "#filter-targeting", "ON")
    render_click(view, "refresh")
    assert has_element?(view, "#filter-targeting", "ON")
  end

  test "mount reads x-demo-preset header when query and cookie omit preset (LiveE2E fingerprint)" do
    conn =
      build_conn()
      |> Plug.Conn.put_req_header("x-demo-preset", "matching")
      |> init_test_session(%{})

    {:ok, view, _} = live(conn, "/")
    assert has_element?(view, "#current-identity", "alice")
    assert has_element?(view, "#filter-targeting", "ON")
  end

  test "preset plug keeps session when a follow-up request omits preset headers" do
    conn =
      build_conn()
      |> Plug.Conn.put_req_header("x-demo-preset", "matching")
      |> init_test_session(%{})

    conn =
      conn
      |> Plug.Conn.fetch_cookies()
      |> Plug.Conn.fetch_session()
      |> Showcase.PresetCookiePlug.call(Showcase.PresetCookiePlug.init([]))

    session = Plug.Conn.get_session(conn)

    follow_up =
      build_conn()
      |> Plug.Conn.fetch_cookies()
      |> init_test_session(session)
      |> Showcase.PresetCookiePlug.call(Showcase.PresetCookiePlug.init([]))

    assert Plug.Conn.get_session(follow_up, "sample_preset") == "matching"
    assert get_in(Plug.Conn.get_session(follow_up, "toggly_context"), ["identity"]) == "alice"
  end

  test "preset plug stores toggly_context for connected Toggly on_mount" do
    conn =
      build_conn()
      |> Plug.Conn.put_req_header("x-demo-preset", "matching")
      |> init_test_session(%{})

    conn =
      conn
      |> Plug.Conn.fetch_cookies()
      |> Plug.Conn.fetch_session()
      |> Showcase.PresetCookiePlug.call(Showcase.PresetCookiePlug.init([]))

    assert Plug.Conn.get_session(conn, "sample_preset") == "matching"
    assert get_in(Plug.Conn.get_session(conn, "toggly_context"), ["identity"]) == "alice"
  end

  test "separate sessions, matching/nonmatching filters and Order.Vip" do
    {:ok, alice, _} = live(build_conn(), "/?preset=matching")
    {:ok, bob, _} = live(build_conn(), "/?preset=matching")
    render_click(bob, "preset", %{"mode" => "non-matching"})
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
