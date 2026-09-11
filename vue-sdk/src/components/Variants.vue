<script setup>
import { inject } from "vue";
import { workshopKey } from "../sample/workshop";
const workshop = inject(workshopKey);
const { state } = workshop;
// Native SDK composables run in setup. Keep refs reactive instead of copying
// their initial value; subscriptions update them after each context refresh.
import { useVariant } from "@ops-ai/vue-feature-flags-toggly";
const variant = useVariant("new-dashboard", workshop.variantService);
</script>
<template>
  <section id="variants" class="panel">
    <div class="section-top">
      <span class="number">07</span>
      <h2>Choose an experience, not just on/off</h2>
    </div>
    <p>
      <code>useVariant</code> reads the real SDK’s variant assignment. A
      separate instance requests evaluated variants because that endpoint
      returns boolean assignments, not the entity-rule payload used above.
    </p>
    <div class="variant-demo" :class="variant.variant.value?.name">
      <strong data-testid="variant-name">{{
        variant.isLoading.value
          ? "Loading…"
          : variant.variant.value?.name || "No assignment"
      }}</strong>
      <p>
        {{
          state.offline
            ? "Recorded offline assignment — no remote experiment is running."
            : "Assignment returned by Toggly. Configure variants on new-dashboard to see a value."
        }}
      </p>
      <pre>{{ JSON.stringify(variant.variantValue.value, null, 2) }}</pre>
    </div>
    <p>
      Use configuration values to adjust presentation. Unknown or absent
      variants keep your existing UI; do not infer an assignment from a flag
      being enabled.
    </p>
  </section>
</template>
