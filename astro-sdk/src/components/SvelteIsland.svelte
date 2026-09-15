<script lang="ts">
  import Feature from '@ops-ai/astro-feature-flags-toggly/svelte/Feature.svelte';
  import FeatureGateBuilder from '@ops-ai/astro-feature-flags-toggly/svelte/FeatureGateBuilder.svelte';
  import { featureFlag, featureGate } from '@ops-ai/astro-feature-flags-toggly/svelte';

  // Svelte helpers wrap the shared client store atoms.
  const dashboard = featureFlag('new-dashboard');
  const anyGate = featureGate(['new-dashboard', 'api-v2'], 'any');
</script>

<section id="svelte-island" class="island">
  <h3>Svelte island</h3>
  <Feature flag="new-dashboard">
    <p id="svelte-dashboard-on">Svelte: new-dashboard ON ({$dashboard})</p>
  </Feature>
  <Feature flag="new-dashboard" negate={true}>
    <p id="svelte-dashboard-off">Svelte: new-dashboard OFF</p>
  </Feature>
  <FeatureGateBuilder flag="enhanced-submit" let:enabled>
    <button id="svelte-submit" type="button" disabled={!enabled}>
      Enhanced submit ({enabled})
    </button>
  </FeatureGateBuilder>
  <p id="svelte-any-gate">
    any(new-dashboard, api-v2): <code>{$anyGate}</code>
  </p>
</section>
