<script>
  import { getContext } from "svelte";
  import {
    Feature,
    FeatureGateBuilder,
    createFeatureStore,
  } from "@ops-ai/svelte-feature-flags-toggly";
  import { workshopKey } from "../sample/workshop";
  const workshop = getContext(workshopKey);
  // Derived store from the process-wide flags store. It ANDs local gates when
  // the service is attached; keep the store itself rather than copying once.
  const dashboard = createFeatureStore("new-dashboard");
</script>

<section id="declarative" class="panel">
  <div class="section-top">
    <span class="number">02</span>
    <h2>Let the template follow the flag</h2>
  </div>
  <p>
    <code>Feature</code> removes its slot when denied. Negate shows the
    existing experience; “all” and “any” combine flags.
  </p>
  <div class="cards">
    <article>
      <h3>Feature + negate</h3>
      <Feature featureKey="new-dashboard">
        <p data-testid="new-ui" class="positive">New dashboard visible</p>
      </Feature>
      <Feature featureKey="new-dashboard" negate={true}>
        <p data-testid="old-ui">Existing dashboard visible</p>
      </Feature>
      <small>Native Feature component from the published Svelte package.</small>
    </article>
    <article>
      <h3>Multi-key gate</h3>
      <Feature featureKeys={["new-dashboard", "api-v2"]} requirement="all">
        <p data-testid="all-on">Both dashboard and API are enabled.</p>
      </Feature>
      <Feature featureKeys={["new-dashboard", "api-v2"]} requirement="any">
        <p data-testid="any-on">At least one experience is enabled.</p>
      </Feature>
    </article>
    <article>
      <h3>Keep a button mounted</h3>
      <FeatureGateBuilder featureKey="enhanced-submit" let:enabled>
        <button
          disabled={!enabled}
          onclick={() => workshop.check()}
          data-testid="builder-button"
        >
          {enabled ? "Enhanced submit" : "Submit unavailable"}
        </button>
      </FeatureGateBuilder>
      <small>
        The builder slot exposes <code>enabled</code>; it does not hide the
        button.
      </small>
    </article>
  </div>
  <p>
    Single-flag derived store:
    <strong data-testid="composable">{$dashboard ? "ON" : "OFF"}</strong>
  </p>
</section>
