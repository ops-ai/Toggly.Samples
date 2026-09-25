<script>
  import { getContext } from "svelte";
  import { workshopKey } from "../sample/workshop";
  const workshop = getContext(workshopKey);
  const session = workshop.session;
  const variant = workshop.dashboardVariant;
  const variantValue = workshop.dashboardVariantValue;
</script>

<section id="variants" class="panel">
  <div class="section-top">
    <span class="number">07</span>
    <h2>Choose an experience, not just on/off</h2>
  </div>
  <p>
    Variant assignments come from a second <code>Toggly</code> instance with
    <code>enableVariants: true</code>. That endpoint returns boolean
    assignments, not the entity-rule payload used by Express Checkout.
  </p>
  <div class="variant-demo" class:compact={$variant?.name === "compact"}>
    <strong data-testid="variant-name">
      {$variant?.name || "No assignment"}
    </strong>
    <p>
      {$session.offline
        ? "Recorded offline assignment — no remote experiment is running."
        : "Assignment returned by Toggly. Configure variants on new-dashboard to see a value."}
    </p>
    <pre>{JSON.stringify($variantValue, null, 2)}</pre>
  </div>
  <p>
    Use configuration values to adjust presentation. Unknown or absent
    variants keep your existing UI; do not infer an assignment from a flag
    being enabled.
  </p>
</section>
