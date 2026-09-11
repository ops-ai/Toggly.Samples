<script setup>
import { inject } from "vue";
import { workshopKey } from "../sample/workshop";
const workshop = inject(workshopKey);
const { state } = workshop;
// Native SDK composables run in setup. Keep refs reactive instead of copying
// their initial value; subscriptions update them after each context refresh.
import {
  useFeatureFlag,
  useFeatureGate,
} from "@ops-ai/vue-feature-flags-toggly";
const single = useFeatureFlag("new-dashboard");
const multi = useFeatureGate({
  featureKeys: ["new-dashboard", "api-v2"],
  requirement: "all",
});
</script>
<template>
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
        <Feature feature-key="new-dashboard"
          ><p data-testid="new-ui" class="positive">
            New dashboard visible
          </p></Feature
        >
        <Feature feature-key="new-dashboard" :negate="true"
          ><p data-testid="old-ui">Existing dashboard visible</p></Feature
        >
        <small>Native globally registered Feature component.</small>
      </article>
      <article>
        <h3>Multi-key gate</h3>
        <Feature :feature-keys="['new-dashboard', 'api-v2']" requirement="all"
          ><p data-testid="all-on">
            Both dashboard and API are enabled.
          </p></Feature
        >
        <Feature :feature-keys="['new-dashboard', 'api-v2']" requirement="any"
          ><p data-testid="any-on">
            At least one experience is enabled.
          </p></Feature
        >
        <p>
          Composable ALL:
          <strong>{{
            multi.isLoading.value
              ? "Checking…"
              : multi.isEnabled.value
                ? "ON"
                : "OFF"
          }}</strong>
        </p>
      </article>
      <article>
        <h3>Keep a button mounted</h3>
        <FeatureGateBuilder feature-key="enhanced-submit" v-slot="{ enabled }">
          <button
            :disabled="!enabled"
            @click="workshop.check()"
            data-testid="builder-button"
          >
            {{ enabled ? "Enhanced submit" : "Submit unavailable" }}
          </button>
        </FeatureGateBuilder>
        <small
          >The builder slot exposes <code>enabled</code>; it does not hide the
          button.</small
        >
      </article>
    </div>
    <p>
      Single-flag composable:
      <strong data-testid="composable">{{
        single.isEnabled.value ? "ON" : "OFF"
      }}</strong>
    </p>
  </section>
</template>
