<script>
  import { setContext } from "svelte";
  import TemplateGates from "./components/TemplateGates.svelte";
  import OrderGate from "./components/OrderGate.svelte";
  import Variants from "./components/Variants.svelte";
  import Actions from "./components/Actions.svelte";
  import FilterMatrix from "./components/FilterMatrix.svelte";
  import { workshopKey } from "./sample/workshop";
  import { demoKeys } from "./sample/catalog";
  let { workshop } = $props();
  setContext(
    workshopKey,
    new Proxy(
      {},
      {
        get(_target, prop) {
          const value = workshop[prop];
          return typeof value === "function" ? value.bind(workshop) : value;
        },
      },
    ),
  );
  const session = $derived(workshop.session);
  const actionStatus = {
    subscribe: (run) => workshop.actionStatus.subscribe(run),
  };
  const sections = [
    ["home", "Start here"],
    ["declarative", "Template gates"],
    ["programmatic", "Actions"],
    ["identity", "Identity"],
    ["order", "Order context"],
    ["filters", "Filters matrix"],
    ["variants", "Variants"],
    ["native", "Svelte surfaces"],
    ["telemetry", "Telemetry"],
  ];
</script>

<header>
  <a href="#home" class="brand">Toggly <span>/ Svelte workshop</span></a>
  <span class="mode" class:live={!$session.offline}>
    {$session.offline ? "OFFLINE FIXTURES" : "LIVE SDK"}
  </span>
</header>
<main>
  <section id="home" class="hero">
    <p class="eyebrow">SVELTE 5 · FEATURE FLAGS, STEP BY STEP</p>
    <h1>Ship the code.<br /><span>Choose the experience.</span></h1>
    <p class="intro">
      A working playground for toggles, user targeting and Order-level
      decisions. Start with one flag, then follow how the same decision
      reaches a template, a button and a derived store.
    </p>
    {#if $session.offline}
      <div class="notice" data-testid="missing-key">
        <strong>No App Key configured.</strong> You are exploring labelled
        offline fixtures through the real Svelte SDK. Add your public App Key
        to <code>.env.local</code> using <code>.env.example</code>, then
        restart Vite for live mode.
      </div>
    {:else}
      <div class="notice">
        Live mode: flags come from your Toggly environment. Offline flag
        switches are disabled. Browser user-agent, language and country come
        from the real request, not the preset labels.
      </div>
    {/if}
    {#if !$session.ready}
      <p role="status">Loading safe defaults…</p>
    {/if}
    {#if $session.error}
      <p role="alert" class="error">
        {$session.error}. Check configuration or recover the offline transport;
        defaults keep controls denied.
      </p>
    {/if}
    <nav aria-label="Workshop sections">
      {#each sections as [id, label], i (id)}
        <a href={`#${id}`}>{String(i + 1).padStart(2, "0")} {label}</a>
      {/each}
    </nav>
  </section>
  <section class="panel">
    <div class="section-top">
      <span class="number">01</span>
      <h2>Your first flag: new-dashboard</h2>
    </div>
    <p>
      In offline mode, switch it off and look for “Existing dashboard” below.
      In live mode, make that change in the Toggly dashboard. A flag changes
      behavior without removing your fallback code.
    </p>
    <div class="flag-list">
      {#each demoKeys as key (key)}
        <button
          disabled={!$session.offline || $session.busy || key === "ExpressCheckout"}
          onclick={() => workshop.toggle(key)}
          data-testid={`toggle-${key}`}
        >
          <code>{key}</code>
          <span class={$session.snapshot[key] ? "on" : "off"}>
            {$session.snapshot[key] ? "ON" : "OFF"}
          </span>
        </button>
      {/each}
    </div>
    <small>
      ExpressCheckout follows the selected Order instead of a global switch.
      This live snapshot is read using actual SDK checks with that Order.
    </small>
  </section>
  {#if $session.ready}
    <TemplateGates />
  {/if}
  <Actions section="programmatic" />
  <section id="identity" class="panel">
    <div class="section-top">
      <span class="number">04</span>
      <h2>Target a session, not a permission</h2>
    </div>
    <p>
      Known identity, groups and claims are configured before evaluation.
      Switching presets calls <code>setContext</code>, which refreshes each
      SDK instance. These values are user-controlled in a browser: they are
      not authorization.
    </p>
    <div class="controls">
      <button
        onclick={() => workshop.preset("matching")}
        disabled={$session.busy}
        data-testid="matching"
      >
        Matching · alice
      </button>
      <button
        onclick={() => workshop.preset("nonmatching")}
        disabled={$session.busy}
        data-testid="nonmatching"
      >
        Non-matching · bob
      </button>
      <span role="status">
        {$session.busy ? "Refreshing…" : "Context settled"}
      </span>
    </div>
    <pre data-testid="user-context">
      {JSON.stringify(
        {
          identity: $session.user.identity,
          groups: $session.user.groups,
          claims: $session.user.claims,
        },
        null,
        2,
      )}
    </pre>
  </section>
  {#if $session.ready}
    <OrderGate />
  {/if}
  <FilterMatrix />
  {#if $session.ready}
    <Variants />
  {/if}
  <Actions section="native" />
  <section id="telemetry" class="panel">
    <div class="section-top">
      <span class="number">09</span>
      <h2>Frontend telemetry</h2>
    </div>
    <p data-testid="telemetry-status" role="status" aria-live="polite">
      {$session.telemetryEnabled
        ? "Telemetry is enabled for both configured client instances. Feature checks are automatic; explicit events require a click."
        : $session.offline
          ? "Offline mode: fixture checks stay local and telemetry is silent."
          : "Telemetry is opted out. Feature evaluation remains active."}
    </p>
    <p>
      Rendering this panel does not record a view. Evaluate the flag to
      select the current identity and variant before recording usage or a
      view. Those buttons stay disabled while that selection is unavailable.
    </p>
    <div class="controls">
      <button
        onclick={() => workshop.evaluateTelemetryFlag()}
        disabled={!$session.ready || $session.busy}
        data-testid="telemetry-evaluate"
      >
        Evaluate new-dashboard
      </button>
      <strong data-testid="telemetry-result">
        {$session.telemetrySelection
          ? `new-dashboard: ${$session.telemetrySelection.enabled ? "ON" : "OFF"} · variant ${$session.telemetrySelection.variant}`
          : "No current selection; evaluate the flag first."}
      </strong>
    </div>
    <div class="controls">
      <button
        onclick={() => workshop.recordTelemetryUsage()}
        disabled={!$session.ready ||
          !$session.telemetryEnabled ||
          $session.busy ||
          !$session.telemetrySelection}
        data-testid="telemetry-usage"
      >
        Record usage
      </button>
      <button
        onclick={() => workshop.recordTelemetryView()}
        disabled={!$session.ready ||
          !$session.telemetryEnabled ||
          $session.busy ||
          !$session.telemetrySelection}
        data-testid="telemetry-view"
      >
        Record view
      </button>
      <button
        onclick={() => workshop.incrementSampleActions()}
        disabled={!$session.ready || !$session.telemetryEnabled || $session.busy}
        data-testid="telemetry-counter"
      >
        Increment sample-actions
      </button>
      <button
        onclick={() => workshop.setSampleCartSize()}
        disabled={!$session.ready || !$session.telemetryEnabled || $session.busy}
        data-testid="telemetry-gauge"
      >
        Set sample-cart-size
      </button>
      <button
        onclick={() => workshop.flushTelemetry()}
        disabled={!$session.ready || !$session.telemetryEnabled || $session.busy}
        data-testid="telemetry-flush"
      >
        Flush telemetry
      </button>
    </div>
    <p data-testid="telemetry-action-status" aria-live="polite">
      {$actionStatus}
    </p>
  </section>
  <footer>
    <strong>Keep your fallback. Keep your authorization.</strong>
    <p>Feature flags select an experience. They do not authenticate a user.</p>
    <a href="https://docs.toggly.io/sdks/javascript/svelte">
      Svelte SDK documentation ↗
    </a>
  </footer>
</main>
