<script setup>
import { inject } from "vue";
import { workshopKey } from "../sample/workshop";
const workshop = inject(workshopKey);
const { state } = workshop;
// Native SDK composables run in setup. Keep refs reactive instead of copying
// their initial value; subscriptions update them after each context refresh.
import { computed } from "vue";
import { useFeatureGate } from "@ops-ai/vue-feature-flags-toggly";
const order = useFeatureGate(
  computed(() => ({
    featureKey: "ExpressCheckout",
    context: state.order,
    contextKind: "Order",
  })),
);
</script>
<template>
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
      <button @click="workshop.order('vip')" :disabled="state.busy">
        VIP Order</button
      ><button @click="workshop.order('standard')" :disabled="state.busy">
        Standard Order
      </button>
    </div>
    <pre>{{ JSON.stringify(state.order, null, 2) }}</pre>
    <Feature
      feature-key="ExpressCheckout"
      :context="state.order"
      context-kind="Order"
      ><p class="positive" data-testid="vip-checkout">
        Express Checkout available for this Order
      </p></Feature
    >
    <p>
      Entity-aware composable:
      <strong data-testid="order-result">{{
        order.isEnabled.value ? "ON" : "OFF"
      }}</strong
      >. No entity means the EntityGate is denied.
    </p>
  </section>
</template>
