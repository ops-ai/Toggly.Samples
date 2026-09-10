<script setup>
const props = defineProps({ section: String });
import { inject, ref } from "vue";
import { workshopKey } from "../sample/workshop";
const workshop = inject(workshopKey);
const { state } = workshop;
const routeMessage = ref("The beta view has not been opened.");
async function visitBeta() {
  routeMessage.value = (await workshop.enterBeta())
    ? "Beta view opened (demo navigation)"
    : "Beta view denied — existing home stays visible";
}
</script>
<template>
  <section
    v-if="props.section === 'programmatic'"
    id="programmatic"
    class="panel"
  >
    <div class="section-top">
      <span class="number">03</span>
      <h2>Check before an action</h2>
    </div>
    <p>
      <code>await service.isFeatureOn('enhanced-submit')</code> branches at the
      action boundary. This sample only prints a result; your server must still
      authorize real mutations.
    </p>
    <button
      @click="workshop.check()"
      :disabled="state.busy"
      data-testid="check-action"
    >
      Run programmatic check
    </button>
    <p role="status" data-testid="action-result">{{ state.checkResult }}</p>
  </section>
  <section v-if="props.section === 'native'" id="native" class="panel">
    <div class="section-top">
      <span class="number">08</span>
      <h2>Vue-specific building blocks</h2>
    </div>
    <div class="cards">
      <article>
        <h3>Device-local prerequisite</h3>
        <p>
          A local gate ANDs with the remote result; it cannot turn a remotely
          disabled flag on.
        </p>
        <button
          @click="workshop.local()"
          :disabled="state.busy"
          data-testid="local-toggle"
        >
          Device prerequisite: {{ state.localAllowed ? "ready" : "not ready" }}
        </button>
        <p>
          Watch the enhanced-submit builder above react to
          <code>notifyLocalGatesChanged()</code>.
        </p>
      </article>
      <article>
        <h3>Compose a navigation check</h3>
        <p>
          The Vue SDK has no router guard export. This button composes its real
          service check to keep a denied view closed.
        </p>
        <button
          @click="visitBeta"
          :disabled="state.busy"
          data-testid="beta-route"
        >
          Open beta view
        </button>
        <p data-testid="route-result">{{ routeMessage }}</p>
      </article>
      <article>
        <h3>Loading, defaults and errors</h3>
        <p>
          Native composables expose loading refs; the workshop disables controls
          during updates. A failed request falls back safely.
        </p>
        <button
          @click="workshop.failure()"
          :disabled="!state.offline || state.busy"
          data-testid="transport-error"
        >
          {{
            state.simulateError
              ? "Recover offline transport"
              : "Simulate transport failure"
          }}
        </button>
      </article>
    </div>
    <p>
      Read <code>src/main.js</code> for plugin installation,
      <code>TemplateGates.vue</code> for native slots/composables, and
      <code>sample/workshop.js</code> for service orchestration. Never import a
      nonexistent createToggly or useToggly helper.
    </p>
  </section>
</template>
