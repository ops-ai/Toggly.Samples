<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useFeatureFlag, useFeatureGate, useFeatureOff, useToggly } from '@ops-ai/nuxt-toggly-client'
import { defaultIdentityForPreset, orderForPreset, type DemoPreset } from '../../lib/demo'

const props = defineProps<{ preset: DemoPreset }>()

// Composables react when fresh definitions arrive. They are browser-scoped:
// this page's identity changes never modify the Nitro process or another user.
const { isEnabled: dashboardOn } = useFeatureFlag('new-dashboard')
const { isEnabled: dashboardOff } = useFeatureOff('new-dashboard')
const { isEnabled: allEnabled } = useFeatureGate(['new-dashboard', 'api-v2'], 'all')
const { isEnabled: anyEnabled } = useFeatureGate(['new-dashboard', 'api-v2'], 'any')
const toggly = useToggly()

// Do not eagerly create a cookie. With no browser session, each preset keeps
// its documented default identity (alice for matching, bob for non-matching).
const identityCookie = useCookie<string | null>('demo-identity', { default: () => null })
const identityInput = ref(identityCookie.value ?? defaultIdentityForPreset(props.preset))
const programmaticResult = ref<boolean | null>(null)
const entityResult = ref<boolean | null>(null)
const actionMessage = ref('')

const order = computed(() => orderForPreset(props.preset))

watch(
  () => props.preset,
  (nextPreset) => {
    if (!identityCookie.value) {
      identityInput.value = defaultIdentityForPreset(nextPreset)
    }
  },
)

async function applyBrowserIdentity() {
  // The cookie gives server requests a per-browser demo session. setIdentity
  // updates this browser SDK only; it deliberately does not carry roles/claims.
  identityCookie.value = identityInput.value
  await toggly.setIdentity(identityInput.value)
  actionMessage.value = `Browser identity is now ${identityInput.value}. Both presets will use this cookie on the next server request.`
}

async function checkProgrammatically() {
  programmaticResult.value = await toggly.isFeatureOn('enhanced-submit')
  entityResult.value = await toggly.isFeatureOn('ExpressCheckout', order.value, 'Order')
}

onMounted(checkProgrammatically)
</script>

<template>
  <section id="declarative" class="panel">
    <p class="eyebrow">2. Declarative gates</p>
    <h2>Let Vue render the enabled and disabled branches</h2>
    <p>
      A feature flag is a named decision. <code>Feature</code>, the composables,
      and <code>v-feature</code> rerun that decision when Toggly refreshes its
      definitions. The existing branch remains available when a flag is off.
    </p>

    <!-- The two components make the off path explicit instead of hiding it. -->
    <Feature feature-key="new-dashboard">
      <p class="result on">new-dashboard is on: render the new dashboard.</p>
    </Feature>
    <Feature feature-key="new-dashboard" negate>
      <p class="result off">new-dashboard is off: keep the established dashboard.</p>
    </Feature>

    <div class="two-up">
      <article>
        <h3>Composable and negate</h3>
        <p><code>useFeatureFlag</code>: <strong>{{ dashboardOn ? 'on' : 'off' }}</strong></p>
        <p><code>useFeatureOff</code>: <strong>{{ dashboardOff ? 'on' : 'off' }}</strong></p>
      </article>
      <article>
        <h3>Multiple keys</h3>
        <p><code>all</code> (new-dashboard + api-v2): <strong>{{ allEnabled ? 'on' : 'off' }}</strong></p>
        <p><code>any</code> (new-dashboard + api-v2): <strong>{{ anyEnabled ? 'on' : 'off' }}</strong></p>
      </article>
    </div>

    <!-- This directive is useful for a small DOM branch without a wrapper. -->
    <p v-feature="'enhanced-submit'" class="result on">enhanced-submit enabled this directive-rendered message.</p>
    <p class="gap"><strong>Variant:</strong> @ops-ai/nuxt-toggly 1.4.0 exposes boolean gates, not an experiment/variant assignment API. This sample keeps that boundary visible rather than inventing a variant.</p>
  </section>

  <section id="programmatic" class="panel">
    <p class="eyebrow">3. Programmatic API</p>
    <h2>Ask for a boolean where a component is not the right shape</h2>
    <p>
      Use <code>isFeatureOn</code> for an event handler, a calculated action, or
      a domain-specific branch. It returns a promise because it can evaluate a
      downloaded definition and its context.
    </p>
    <button type="button" @click="checkProgrammatically">Evaluate enhanced-submit and this Order</button>
    <p v-if="programmaticResult !== null">enhanced-submit: <strong>{{ programmaticResult ? 'on' : 'off' }}</strong></p>
    <p v-if="entityResult !== null">ExpressCheckout for <code>{{ order.key }}</code>: <strong>{{ entityResult ? 'on' : 'off' }}</strong></p>
    <TelemetryActions :vip="order.attributes.Vip" />
  </section>

  <section id="identity" class="panel">
    <p class="eyebrow">4. Identity</p>
    <h2>Keep one person’s evaluation inputs inside that person’s session</h2>
    <p>
      This control updates the browser client and a browser cookie for this demo.
      Nitro resolves the cookie into the current H3 event through
      <code>configureEventEvalContext</code>; no request mutates process-wide identity.
      In a real app, derive identity and claims from trusted authentication data.
    </p>
    <label>
      Browser identity
      <input v-model="identityInput" aria-label="Browser identity" />
    </label>
    <button type="button" @click="applyBrowserIdentity">Apply browser identity</button>
    <p v-if="actionMessage" class="note">{{ actionMessage }}</p>
  </section>

  <section id="entity" class="panel">
    <p class="eyebrow">5. Entity context</p>
    <h2>Evaluate ExpressCheckout for an Order, not for the user</h2>
    <p>
      The selected Order is <code>{{ order.key }}</code> with
      <code>Vip={{ order.attributes.Vip }}</code>. <code>key</code> maps to the
      dashboard’s <code>Order.Id</code>; <code>attributes.Vip</code> maps to
      <code>Order.Vip</code>. Entity context is passed to this one check, never
      attached to identity.
    </p>
    <Feature feature-key="ExpressCheckout" :context="order" context-kind="Order">
      <p class="result on">VIP Order branch: show Express Checkout.</p>
    </Feature>
    <Feature feature-key="ExpressCheckout" :context="order" context-kind="Order" negate>
      <p class="result off">Standard Order branch: show normal checkout.</p>
    </Feature>
  </section>

  <section id="nuxt-surfaces" class="panel">
    <p class="eyebrow">7. Nuxt-specific surfaces</p>
    <h2>Use a protected Nitro handler with the same event context</h2>
    <p>
      <code>/api/beta</code> is wrapped by <code>defineFeatureHandler('beta-access')</code>.
      It returns the handler payload only when that flag is enabled for the H3 event.
    </p>
    <NuxtLink :to="`/api/beta?preset=${preset}`">Open the beta handler</NuxtLink>
  </section>
</template>
