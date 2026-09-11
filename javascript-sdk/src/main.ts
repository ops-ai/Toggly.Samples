// The published 1.7.4 bundle runs for its side effect: it installs window.Toggly.
// It is a browser IIFE, so a named ESM import would promise an export it lacks.
import '@ops-ai/feature-flags-toggly'
import { createTogglyConfig, matchingPreset } from './demo'
import { mountSample } from './sample-app'
import './style.css'

// VITE_ is Vite's browser-exposure prefix, not part of a Toggly credential name.
// Vite reads .env.local at startup and embeds these values in production builds.
// Use a public application key here, never a management/API secret.
const appKey = import.meta.env.VITE_TOGGLY_APP_KEY?.trim() ?? ''
const configured = Boolean(appKey && appKey !== 'ci-placeholder')
const environment = import.meta.env.VITE_TOGGLY_ENVIRONMENT || 'Production'
const Toggly = window.Toggly
// Keys identify dashboard flags exactly; an environment selects their rule set.
// These booleans are a teaching fixture used ONLY without a real app key. They
// do not create flags in Toggly and are not supplied as live-mode fallbacks.
const defaults = { 'new-dashboard': true, 'api-v2': false, 'enhanced-submit': true, ExpressCheckout: false, 'beta-access': false, 'filter-always-on': true }

// Register a local translator from our order shape to the SDK entity shape.
// This does not provision the dashboard kind. Vip is the attribute the returned
// entity rule reads; orderId becomes its key, and unrelated preset fields vanish.
Toggly.registerContext<typeof matchingPreset>('Order', value => ({ kind: 'Order', key: value.orderId, attributes: { Vip: value.vip } }))
// Keep an existing SDK identity instead of resetting it on every page load.
// In 1.7.4 identity AND claims live in origin-wide localStorage, even when flag
// cache persistence is off. These demo claims are targeting input, not login or
// proof of an admin role; browser feature gates cannot authorize server actions.
if (!Toggly.evaluationContext.identity) {
  Toggly.identity = matchingPreset.identity
  Toggly.claims = matchingPreset.claims
}

let app: ReturnType<typeof mountSample> | undefined
// A refresh can finish during init, before the DOM app exists. Later refreshes
// (including WebSocket-triggered ones) repaint via this supported lifecycle hook.
// Receiving updates is asynchronous and depends on network/service availability.
const refreshHook = {
  getMetadata: () => ({ name: 'sample-dom-refresh', version: '1.0.0' }),
  afterRefresh: async () => { app?.onRefresh() },
}
// Wait before reading synchronous flag APIs. Resolution can mean cached/default
// values after an error, not a successful live fetch; the UI also reads lastError.
await Toggly.init({ ...createTogglyConfig(appKey, defaults, environment), hooks: [refreshHook] })
app = mountSample(document.querySelector('#app')!, Toggly, { configured, environment })
app.render()
