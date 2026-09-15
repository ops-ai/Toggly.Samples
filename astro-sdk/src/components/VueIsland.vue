<script setup lang="ts">
import Feature from '@ops-ai/astro-feature-flags-toggly/vue/Feature.vue';
import FeatureGateBuilder from '@ops-ai/astro-feature-flags-toggly/vue/FeatureGateBuilder.vue';
import { useFeatureFlag, useFeatureGate } from '@ops-ai/astro-feature-flags-toggly/vue';

// Vue island composables read the same nanostores client as /client/setup.
const dashboard = useFeatureFlag('new-dashboard');
const anyGate = useFeatureGate(['new-dashboard', 'api-v2'], 'any');
</script>

<template>
  <section id="vue-island" class="island">
    <h3>Vue island</h3>
    <p>ready: <code>{{ dashboard.isReady }}</code></p>
    <Feature flag="new-dashboard">
      <p id="vue-dashboard-on">Vue: new-dashboard ON ({{ dashboard.enabled }})</p>
    </Feature>
    <Feature flag="new-dashboard" :negate="true">
      <p id="vue-dashboard-off">Vue: new-dashboard OFF</p>
    </Feature>
    <FeatureGateBuilder flag="enhanced-submit" v-slot="{ enabled }">
      <button id="vue-submit" type="button" :disabled="!enabled">
        Enhanced submit ({{ enabled }})
      </button>
    </FeatureGateBuilder>
    <p id="vue-any-gate">
      any(new-dashboard, api-v2): <code>{{ anyGate.enabled }}</code>
    </p>
  </section>
</template>
