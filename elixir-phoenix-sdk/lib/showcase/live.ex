defmodule Showcase.Live do
  use Phoenix.LiveView
  import Toggly.LiveView, only: [feature: 1]

  @filters ~w(filter-always-on filter-percentage filter-targeting filter-user-claims filter-time-window filter-country filter-browser-family filter-browser-language filter-device-type filter-os filter-context-property)
  @keys ~w(new-dashboard api-v2 enhanced-submit ExpressCheckout beta-access) ++ @filters
  on_mount({Toggly.LiveView, {Showcase.Flags, @keys}})

  def mount(_, _, socket) do
    # The on_mount hook installs subscriptions. The demo then assigns its local
    # preset; real applications derive context from their signed auth session.
    context = Showcase.Context.preset("matching")
    socket = Toggly.LiveView.assign_feature_flags(socket, Showcase.Flags, @keys, context: context)

    {:ok,
     assign(socket,
       offline: Application.fetch_env!(:toggly_showcase, :offline),
       filters: @filters,
       keys: @keys,
       action: "No action yet",
       preset: "matching",
       refresh: "Waiting"
     )}
  end

  def handle_event("preset", %{"mode" => mode}, socket) do
    socket =
      Toggly.LiveView.assign_feature_flags(socket, Showcase.Flags, @keys,
        context: Showcase.Context.preset(mode)
      )

    {:noreply, assign(socket, :preset, mode)}
  end

  def handle_event("submit", _, socket) do
    # Reevaluate at the mutation boundary. Hiding a button alone is insufficient.
    enabled = Toggly.enabled?(Showcase.Flags, "enhanced-submit", socket.assigns.toggly_context)
    if enabled, do: Toggly.record_usage(Showcase.Flags, "enhanced-submit")

    {:noreply,
     assign(
       socket,
       :action,
       if(enabled, do: "Enhanced submission accepted", else: "Enhanced submission unavailable")
     )}
  end

  def handle_event("refresh", _, socket) do
    result = Toggly.refresh(Showcase.Flags)
    {:noreply, assign(socket, :refresh, inspect(result))}
  end

  def render(assigns) do
    ~H"""
    <header class="masthead">
      <a href="#home">TOGGLY <span>/ PHOENIX</span></a><span class="badge">ELIXIR · OTP · LIVEVIEW</span>
    </header>
    <main>
      <div :if={@offline} class="notice" role="status" id="missing-key">
        Missing TOGGLY_APP_KEY — running local demonstration definitions. No dashboard connection is claimed.
      </div>
      <section id="home" class="hero">
        <p class="eyebrow">01 / HOME</p><h1>One definition.<br />Every connected view.</h1>
        <p class="intro">
          Explore feature decisions with Phoenix requests, isolated LiveView identities and an Order context. Change a preset to see the same rules produce different results.
        </p>
        <nav>
          <a href="#declarative">Gates</a><a href="#api">API</a><a href="#identity">Identity</a><a href="#entity">Order</a><a href="#filters">Filters</a><a href="#phoenix">Phoenix</a>
        </nav>
        <div class="toolbar">
          <button phx-click="preset" phx-value-mode="matching" aria-pressed={@preset == "matching"}>Matching · Alice</button><button
            phx-click="preset"
            phx-value-mode="nonmatching"
            aria-pressed={@preset == "nonmatching"}
          >Non-matching · Bob</button><span id="current-identity">{@toggly_context["identity"]}</span>
        </div>
        <h3>Flag checklist / live view snapshot</h3>
        <div class="snapshot">
          <div :for={key <- @keys}>
            <code>{key}</code><strong class={if @toggly_flags[key], do: "on", else: "off"}>{if @toggly_flags[
                                                                                                 key
                                                                                               ],
                                                                                               do:
                                                                                                 "ON",
                                                                                               else:
                                                                                                 "OFF"}</strong>
          </div>
        </div>
      </section>
      <section id="declarative">
        <p class="eyebrow">02 / DECLARATIVE GATES</p><h2>Choose what the view renders.</h2>
        <%!-- The component consumes socket-local booleans, keeping identities out of a shared client. --%>
        <.feature flags={@toggly_flags} feature="new-dashboard">
          <div class="panel" id="new-dashboard">New dashboard enabled</div><:fallback>
            <div class="panel">Classic dashboard fallback</div>
          </:fallback>
        </.feature>
        <.feature flags={@toggly_flags} feature="new-dashboard" negate>
          <p>Negated gate: the classic dashboard is active.</p>
        </.feature>
        <.feature flags={@toggly_flags} feature={["new-dashboard", "api-v2"]} requirement={:all}>
          <p>All gate: dashboard and API v2 enabled.</p><:fallback>
            <p>All gate: at least one flag is off.</p>
          </:fallback>
        </.feature>
        <.feature flags={@toggly_flags} feature={["new-dashboard", "api-v2"]} requirement={:any}>
          <p>Any gate: at least one feature is enabled.</p>
        </.feature>
        <p class="muted">
          Variant surface: boolean enabled/disabled branches only. This SDK does not assign multivariate experiments.
        </p>
      </section>
      <section id="api">
        <p class="eyebrow">03 / PROGRAMMATIC API</p><h2>Check again where work happens.</h2><p>
          The submit handler evaluates <code>enhanced-submit</code>
          on the server and records usage only when work runs.
        </p><button phx-click="submit">Try enhanced submission</button><output id="action-result">{@action}</output><pre>Toggly.enabled?(Showcase.Flags, "enhanced-submit", context)</pre>
      </section>
      <section id="identity">
        <p class="eyebrow">04 / IDENTITY</p><h2>Two users. Independent decisions.</h2><p>
          Each LiveView socket carries its own identity, groups, claims and request attributes. Open two tabs and choose different presets; neither changes the other's context.
        </p><dl>
          <dt>Identity</dt><dd>{@toggly_context["identity"]}</dd><dt>Role</dt><dd>
            {@toggly_context["claims"]["role"]}
          </dd><dt>Country</dt><dd>{@toggly_context["request"]["country"]}</dd>
        </dl><p class="muted">
          These selectable claims are demo inputs. They are not authentication.
        </p>
      </section>
      <section id="entity">
        <p class="eyebrow">05 / ENTITY CONTEXT</p><h2>Express checkout belongs to an Order.</h2><p>
          Context kind <code>Order</code>, key <code>{@toggly_context["entity"]["key"]}</code>, attribute <code>Vip={to_string(@toggly_context["entity"]["attributes"]["Vip"])}</code>.
        </p><.feature flags={@toggly_flags} feature="ExpressCheckout">
          <div class="panel" id="express-result">ExpressCheckout available for this VIP order.</div><:fallback>
            <div class="panel" id="express-result">Standard checkout for this order.</div>
          </:fallback>
        </.feature><p>The entity condition is mandatory even if a user condition also passes.</p>
      </section>
      <section id="filters">
        <p class="eyebrow">06 / FILTER MATRIX</p><h2>See the rule behind the result.</h2><p>
          Matching and Non-matching use the shared flag template. AlwaysOn stays on; TimeWindow stays on while open; Percentage is sticky and need not switch with the presets.
        </p><table>
          <thead>
            <tr>
              <th>Feature key</th><th>Result</th>
            </tr>
          </thead><tbody>
            <tr :for={key <- @filters}>
              <td><code>{key}</code></td><td id={key}>
                {if @toggly_flags[key], do: "ON", else: "OFF"}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <section id="phoenix">
        <p class="eyebrow">07 / PHOENIX + OTP</p><h2>Supervise once. Update everywhere.</h2><p>
          The OTP supervisor owns refresh and WebSocket reconnection; LiveView hooks reevaluate current context on updates and resubscribe after a client restart. Process monitors remove disconnected subscribers.
        </p><a href="/protected">Try the beta-access Plug route →</a><div class="toolbar">
          <button phx-click="refresh">Refresh definitions</button><code id="refresh-result">{@refresh}</code>
        </div><p>
          Polling defaults to 60 seconds. A failed fetch preserves last-known-good definitions. Missing keys fall back to explicit false defaults. Gates do not replace authorization.
        </p>
      </section>
      <footer>
        Toggly feature flags · Phoenix field guide ·
        <a href="https://docs.toggly.io/sdks/elixir">SDK documentation</a>
      </footer>
    </main>
    """
  end
end
