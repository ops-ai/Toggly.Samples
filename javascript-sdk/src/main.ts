import '@ops-ai/feature-flags-toggly'
import { createTogglyConfig, matchingPreset } from './demo'
import { mountSample } from './sample-app'
import './style.css'

const appKey = import.meta.env.VITE_TOGGLY_APP_KEY?.trim() ?? ''
const configured = Boolean(appKey && appKey !== 'ci-placeholder')
const environment = import.meta.env.VITE_TOGGLY_ENVIRONMENT || 'Production'
const Toggly = window.Toggly
const defaults = { 'new-dashboard': true, 'api-v2': false, 'enhanced-submit': true, ExpressCheckout: false, 'beta-access': false, 'filter-always-on': true }

Toggly.registerContext<typeof matchingPreset>('Order', value => ({ kind: 'Order', key: value.orderId, attributes: { Vip: value.vip } }))
if (!Toggly.evaluationContext.identity) {
  Toggly.identity = matchingPreset.identity
  Toggly.claims = matchingPreset.claims
}

let app: ReturnType<typeof mountSample> | undefined
const refreshHook = {
  getMetadata: () => ({ name: 'sample-dom-refresh', version: '1.0.0' }),
  afterRefresh: async () => { app?.onRefresh() },
}
await Toggly.init({ ...createTogglyConfig(appKey, defaults, environment), hooks: [refreshHook] })
app = mountSample(document.querySelector('#app')!, Toggly, { configured, environment })
app.render()
