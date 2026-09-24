<script lang="ts">
  import type { TogglyStore } from '@ops-ai/toggly-sveltekit';

  export let toggly: TogglyStore;

  let status = 'No browser telemetry queued yet.';
  // This evaluation is reactive to the layout store. Explicit event buttons
  // reuse its result and therefore do not trigger an extra feature check.
  $: dashboardEnabled = $toggly ? toggly.isEnabled('new-dashboard') : false;

  function queueTelemetry() {
    const variant = dashboardEnabled ? 'enabled' : 'disabled';
    toggly.recordUsage('new-dashboard', variant);
    toggly.recordView('new-dashboard', variant);
    toggly.incrementCounter('sveltekit-demo-actions', 1);
    toggly.setGauge('sveltekit-demo-cart-size', 3);
    status = `Queued explicit events for ${$toggly.context.identity || 'anonymous'}.`;
  }

  async function flushTelemetry() {
    await toggly.flushTelemetry();
    status = `Flushed browser telemetry for ${$toggly.context.identity || 'anonymous'}.`;
  }
</script>

<section class="telemetry-card" aria-labelledby="browser-telemetry-heading">
  <h2 id="browser-telemetry-heading">Layout-owned browser telemetry</h2>
  <p>
    One reporter follows this layout's browser client across SvelteKit navigation. Current identity:
    <span data-testid="telemetry-identity">{$toggly.context.identity || 'anonymous'}</span>;
    new-dashboard: <span data-testid="telemetry-current-result">{String(dashboardEnabled)}</span>.
  </p>
  <p>
    Rendering and direct/gate checks are automatic; usage, views and application metrics below are
    explicit.
  </p>
  <div class="actions">
    <button data-testid="queue-browser-telemetry" on:click={queueTelemetry}>
      Queue usage, view and metrics
    </button>
    <button data-testid="flush-browser-telemetry" on:click={flushTelemetry}>Flush telemetry</button>
  </div>
  <p aria-live="polite" data-testid="telemetry-status">{status}</p>
</section>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .telemetry-card {
    background: white;
    border: 1px solid #e0e5f0;
    border-radius: 14px;
    padding: 24px;
    margin-top: 20px;
  }
</style>
