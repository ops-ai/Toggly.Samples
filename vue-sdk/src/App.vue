<script setup>
import { inject } from "vue";
import TemplateGates from "./components/TemplateGates.vue";
import OrderGate from "./components/OrderGate.vue";
import Variants from "./components/Variants.vue";
import Actions from "./components/Actions.vue";
import FilterMatrix from "./components/FilterMatrix.vue";
import { workshopKey } from "./sample/workshop";
import { demoKeys } from "./sample/catalog";
const workshop = inject(workshopKey);
const { state } = workshop;
const sections = [
  ["home", "Start here"],
  ["declarative", "Template gates"],
  ["programmatic", "Actions"],
  ["identity", "Identity"],
  ["order", "Order context"],
  ["filters", "Filters matrix"],
  ["variants", "Variants"],
  ["native", "Vue surfaces"],
];
</script>
<template>
  <header>
    <a href="#home" class="brand">Toggly <span>/ Vue workshop</span></a
    ><span class="mode" :class="{ live: !state.offline }">{{
      state.offline ? "OFFLINE FIXTURES" : "LIVE SDK"
    }}</span>
  </header>
  <main>
    <section id="home" class="hero">
      <p class="eyebrow">VUE 3 · FEATURE FLAGS, STEP BY STEP</p>
      <h1>Ship the code.<br /><span>Choose the experience.</span></h1>
      <p class="intro">
        A working playground for toggles, user targeting and Order-level
        decisions. Start with one flag, then follow how the same decision
        reaches a template, a button and a composable.
      </p>
      <div v-if="state.offline" class="notice" data-testid="missing-key">
        <strong>No App Key configured.</strong> You are exploring labelled
        offline fixtures through the real Vue SDK. Add your public App Key to
        <code>.env.local</code> using <code>.env.example</code>, then restart
        Vite for live mode.
      </div>
      <div v-else class="notice">
        Live mode: flags come from your Toggly environment. Offline flag
        switches are disabled. Browser user-agent, language and country come
        from the real request, not the preset labels.
      </div>
      <p v-if="!state.ready" role="status">Loading safe defaults…</p>
      <p v-if="state.error" role="alert" class="error">
        {{ state.error }}. Check configuration or recover the offline transport;
        defaults keep controls denied.
      </p>
      <nav aria-label="Workshop sections">
        <a v-for="([id, label], i) in sections" :key="id" :href="`#${id}`"
          >{{ String(i + 1).padStart(2, "0") }} {{ label }}</a
        >
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
        <button
          v-for="key in demoKeys"
          :key="key"
          :disabled="!state.offline || state.busy || key === 'ExpressCheckout'"
          @click="workshop.toggle(key)"
          :data-testid="`toggle-${key}`"
        >
          <code>{{ key }}</code
          ><span :class="state.snapshot[key] ? 'on' : 'off'">{{
            state.snapshot[key] ? "ON" : "OFF"
          }}</span>
        </button>
      </div>
      <small
        >ExpressCheckout follows the selected Order instead of a global switch.
        This live snapshot is read using actual SDK checks with that
        Order.</small
      >
    </section>
    <TemplateGates v-if="state.ready" />
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
          @click="workshop.preset('matching')"
          :disabled="state.busy"
          data-testid="matching"
        >
          Matching · alice</button
        ><button
          @click="workshop.preset('nonmatching')"
          :disabled="state.busy"
          data-testid="nonmatching"
        >
          Non-matching · bob</button
        ><span role="status">{{
          state.busy ? "Refreshing…" : "Context settled"
        }}</span>
      </div>
      <pre data-testid="user-context">{{
        JSON.stringify(
          {
            identity: state.user.identity,
            groups: state.user.groups,
            claims: state.user.claims,
          },
          null,
          2,
        )
      }}</pre>
    </section>
    <OrderGate v-if="state.ready" />
    <FilterMatrix />
    <Variants v-if="state.ready" />
    <Actions section="native" />
    <footer>
      <strong>Keep your fallback. Keep your authorization.</strong>
      <p>
        Feature flags select an experience. They do not authenticate a user.
      </p>
      <a href="https://docs.toggly.io/sdks/javascript/vue"
        >Vue SDK documentation ↗</a
      >
    </footer>
  </main>
</template>
