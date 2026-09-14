<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { allFlagKeys, filterFlags, type DemoPreset } from '../../lib/demo'

const config = useRuntimeConfig()
const appKeyPresent = computed(() => Boolean(config.public.toggly?.appKey))
const preset = ref<DemoPreset>('matching')

// The live snapshot is server evaluated. Nuxt runs this through a fresh H3
// event, so its identity/claims/request values never become process globals.
const { data: snapshot, status, refresh } = await useAsyncData(
  'toggly-snapshot',
  () => $fetch('/api/snapshot', { query: { preset: preset.value } }),
)

watch(preset, () => refresh())

function choosePreset(next: DemoPreset) {
  preset.value = next
}
</script>

<template>
  <main>
    <header class="hero">
      <p class="eyebrow">Toggly Samples · Nuxt 4 family showcase</p>
      <h1>Learn feature flags from definition to Nuxt UI and Nitro request</h1>
      <p>
        This is a runnable map of the published Nuxt module, browser client,
        Nitro server helpers, and shared core. Start with one safe boolean flag,
        then add user targeting, an Order entity, and filter inputs.
      </p>
      <nav aria-label="Sample sections">
        <a href="#home">Home</a><a href="#declarative">Gates</a><a href="#programmatic">API</a>
        <a href="#identity">Identity</a><a href="#entity">Order</a><a href="#filters">Filters</a>
        <a href="#nuxt-surfaces">Nuxt surfaces</a><a href="#configuration">Configuration</a>
      </nav>
    </header>

    <section v-if="!appKeyPresent" id="configuration" class="banner">
      <h2>Missing Toggly application key</h2>
      <p>
        The app is intentionally still running with safe, off defaults. Copy
        <code>.env.example</code> to ignored <code>.env</code>, add your
        own <code>TOGGLY_APP_KEY</code>, then restart <code>npm run dev</code>.
        This Nuxt sample uses <code>TOGGLY_APP_KEY</code>; there is no Vite-prefixed variable.
      </p>
    </section>

    <section id="home" class="panel">
      <p class="eyebrow">1. Home</p>
      <h2>Map the sample and inspect the current request snapshot</h2>
      <p>
        A flag definition lives in Toggly. The SDK fetches it for this application
        and evaluates it with the current context. An off result chooses the
        established behavior; it does not authorize a user or protect data.
      </p>
      <div class="two-up">
        <article>
          <h3>First toggle exercise</h3>
          <ol>
            <li>Create the five baseline flags from the README.</li>
            <li>Turn <code>new-dashboard</code> on in Production.</li>
            <li>Refresh this page and compare its declarative branches.</li>
          </ol>
        </article>
        <article>
          <h3>Live snapshot</h3>
          <p>Source: <strong>{{ snapshot?.source ?? status }}</strong></p>
          <p>Preset: <strong>{{ snapshot?.preset ?? preset }}</strong>; identity: <strong>{{ snapshot?.identity ?? 'loading' }}</strong></p>
          <p>Order: <code>{{ snapshot?.order?.key ?? 'loading' }}</code> (Vip={{ snapshot?.order?.attributes?.Vip ?? false }})</p>
        </article>
      </div>
      <ul class="checklist">
        <li v-for="flag in allFlagKeys" :key="flag">
          <code>{{ flag }}</code>
          <strong :class="snapshot?.flags?.[flag] ? 'on-text' : 'off-text'">{{ snapshot?.flags?.[flag] ? 'on' : 'off' }}</strong>
        </li>
      </ul>
    </section>

    <!-- The module plugin is browser-only. Keeping browser gates inside
         ClientOnly prevents SSR from treating a browser identity as server state. -->
    <ClientOnly fallback-tag="section" fallback="Loading the browser gate examples…">
      <ClientGates :preset="preset" />
    </ClientOnly>

    <section id="filters" class="panel">
      <p class="eyebrow">6. Filters matrix</p>
      <h2>Compare repeatable matching and non-matching request context</h2>
      <p>
        These presets are teaching inputs, not authentication. Matching uses
        alice/admin/US/Chrome/macOS/en and VIP Order; non-matching uses
        bob/user/CA/Firefox/Windows/fr and a standard Order. Percentage is
        deliberately identity-sticky, so either result is valid for that row.
      </p>
      <p class="controls">
        <button type="button" :aria-pressed="preset === 'matching'" @click="choosePreset('matching')">Matching preset</button>
        <button type="button" :aria-pressed="preset === 'non-matching'" @click="choosePreset('non-matching')">Non-matching preset</button>
      </p>
      <table>
        <thead><tr><th>Flag</th><th>Rule</th><th>Current server result</th></tr></thead>
        <tbody>
          <tr v-for="flag in filterFlags" :key="flag">
            <td><code>{{ flag }}</code></td>
            <td>{{ snapshot?.filterDescriptions?.[flag] }}</td>
            <td><strong :class="snapshot?.flags?.[flag] ? 'on-text' : 'off-text'">{{ snapshot?.flags?.[flag] ? 'on' : 'off' }}</strong></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section id="configuration" class="panel">
      <p class="eyebrow">8. Configuration and failure behavior</p>
      <h2>Make absence visible and let safe defaults protect the new path</h2>
      <p>
        The server snapshot reports <strong>defaults</strong> with no app key and
        all feature defaults are off. With a valid key it reports <strong>live</strong>.
        The module exposes browser errors through <code>useToggly().error</code>;
        production monitoring should collect that error while the product keeps
        its intended fallback behavior.
      </p>
      <p>Read <NuxtLink to="https://docs.toggly.io/sdks/nuxt">the Nuxt SDK documentation</NuxtLink> and this repository’s README before adapting the demo extractors to a real session.</p>
    </section>
  </main>
</template>

<style>
:root { color: #e9edf6; background: #111827; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; background: #111827; }
main { max-width: 1040px; margin: 0 auto; padding: 2rem 1rem 4rem; }
.hero, .panel, .banner { border: 1px solid #334155; border-radius: 14px; padding: 1.5rem; margin-bottom: 1rem; background: #172033; }
.hero { background: linear-gradient(135deg, #172554, #172033); }
h1, h2, h3 { margin-top: 0; color: white; }
p, li, td, th { line-height: 1.55; }
a { color: #93c5fd; margin-right: 1rem; }
code { color: #c4b5fd; overflow-wrap: anywhere; }
.eyebrow { color: #67e8f9; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; font-size: .78rem; }
.banner { border-color: #f59e0b; background: #3b2f14; }
.two-up { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
.two-up article { background: #0f172a; padding: 1rem; border-radius: 8px; }
.checklist { columns: 2; padding-left: 1.2rem; }
.checklist li { break-inside: avoid; display: flex; gap: .5rem; justify-content: space-between; }
.result, .note, .gap { padding: .75rem; border-radius: 8px; }
.result.on { background: #123524; }.result.off { background: #3a1d2b; }.note { background: #172554; }.gap { background: #332509; }
.on-text { color: #86efac; }.off-text { color: #fda4af; }
button, input { font: inherit; padding: .55rem .75rem; border-radius: 6px; border: 1px solid #64748b; margin: .25rem; }
button { background: #2563eb; color: white; cursor: pointer; } input { color: #111827; }
table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid #334155; text-align: left; padding: .65rem; vertical-align: top; }
@media (max-width: 640px) { .checklist { columns: 1; } nav a { display: inline-block; margin-bottom: .5rem; } }
</style>
