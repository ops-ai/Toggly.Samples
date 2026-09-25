<script>
  import { getContext } from "svelte";
  import { Feature } from "@ops-ai/svelte-feature-flags-toggly";
  import { workshopKey } from "../sample/workshop";
  const workshop = getContext(workshopKey);
  const session = workshop.session;
</script>

<section id="order" class="panel">
  <div class="section-top">
    <span class="number">05</span>
    <h2>Same user. Different Order.</h2>
  </div>
  <p>
    Context Property checks use this Order only. The mapper sends
    <code>kind / key / attributes</code>; it does not change user identity or
    upload a schema from the browser.
  </p>
  <div class="controls">
    <button onclick={() => workshop.order("vip")} disabled={$session.busy}>
      VIP Order
    </button>
    <button
      onclick={() => workshop.order("standard")}
      disabled={$session.busy}
    >
      Standard Order
    </button>
  </div>
  <pre>{JSON.stringify($session.order, null, 2)}</pre>
  <Feature
    featureKey="ExpressCheckout"
    context={$session.order}
    contextKind="Order"
  >
    <p class="positive" data-testid="vip-checkout">
      Express Checkout available for this Order
    </p>
  </Feature>
  <p>
    Entity-aware service check:
    <strong data-testid="order-result">
      {$session.snapshot.ExpressCheckout ? "ON" : "OFF"}
    </strong>. No entity means the EntityGate is denied.
  </p>
</section>
