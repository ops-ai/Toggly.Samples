<script setup lang="ts">
import { ref } from 'vue'
import { useToggly } from '@ops-ai/nuxt-toggly-client'

const props = defineProps<{ vip: boolean }>()
const toggly = useToggly()
const message = ref('')

async function recordDemoTelemetry() {
  // Status changes update only this control, leaving gate-owning siblings alone.
  toggly.telemetry.recordUsage('enhanced-submit')
  toggly.telemetry.recordView('new-dashboard')
  toggly.telemetry.incrementCounter('demo-actions', 1)
  toggly.telemetry.setGauge('demo-cart-size', props.vip ? 3 : 1)
  await toggly.telemetry.flushTelemetry()
  message.value = 'Browser telemetry flushed for this demo action.'
}
</script>

<template>
  <div>
    <button type="button" @click="recordDemoTelemetry">Record demo usage, view, counter and gauge</button>
    <p v-if="message" class="note">{{ message }}</p>
  </div>
</template>
