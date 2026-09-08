import '@ops-ai/feature-flags-toggly'
import { createSnapshot, createTogglyConfig, matchingPreset, nonMatchingPreset, type FlagReader } from './demo'
import './style.css'

const appKey = import.meta.env.VITE_TOGGLY_APP_KEY?.trim() ?? ''
const Toggly = window.Toggly
const configured = Boolean(appKey && appKey !== 'ci-placeholder')
const defaults = { 'new-dashboard': true, 'api-v2': false, 'enhanced-submit': true, ExpressCheckout: false, 'beta-access': false, 'filter-always-on': true }
type Preset = typeof matchingPreset
let preset: Preset = matchingPreset

Toggly.registerContext<Preset>('Order', (value) => ({ kind: 'Order', key: value.orderId, attributes: { Vip: value.vip } }))
await Toggly.init(createTogglyConfig(appKey, defaults, import.meta.env.VITE_TOGGLY_ENVIRONMENT || 'Production'))

const reader: FlagReader = {
  isFeatureOn: (key, context, kind) => Toggly.isFeatureOn(key, context, kind),
  // The published UMD bundle exposes Toggly on window; its internal enum uses all=0, any=1.
  evaluateFeatureGate: (keys, requirement, negate) => Toggly.evaluateFeatureGate(keys, requirement === 'any' ? 1 : 0, negate),
  getVariant: (key) => Toggly.getVariant(key),
}

const keys = ['new-dashboard','api-v2','enhanced-submit','ExpressCheckout','beta-access','filter-always-on','filter-percentage','filter-targeting','filter-user-claims','filter-time-window','filter-country','filter-browser-family','filter-browser-language','filter-device-type','filter-os','filter-context-property']
const state = (on: boolean) => `<strong class="${on ? 'on' : 'off'}">${on ? 'ON' : 'OFF'}</strong>`

function render() {
  const snapshot = createSnapshot(reader)
  const orderOn = Toggly.isFeatureOn('ExpressCheckout', preset, 'Order')
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<main>
    <h1>JavaScript SDK Sample</h1><p class="lede">A vanilla TypeScript showcase for <code>@ops-ai/feature-flags-toggly</code>. ${configured ? 'Values come from live Toggly evaluation and refresh.' : 'Offline demonstration mode uses explicitly labelled local defaults and makes no Toggly network request.'}</p>
    ${configured ? '' : '<div class="banner"><strong>Missing app key.</strong> Set <code>VITE_TOGGLY_APP_KEY</code> in <code>.env.local</code> for live evaluation. Current values are offline placeholders.</div>'}
    <nav>${['home','gates','api','identity','entity','filters','unique','configuration'].map(x => `<a href="#${x}">${x}</a>`).join('')}</nav>
    <section id="home"><h2>1. Home</h2><p>Flag checklist and ${configured ? 'live' : 'offline placeholder'} snapshot.</p><div class="grid">${keys.map(k => `<div class="card"><code>${k}</code><br>${state(Toggly.isFeatureOn(k))}</div>`).join('')}</div></section>
    <section id="gates"><h2>2. Declarative gates</h2><p>Vanilla JavaScript has no component syntax, so these DOM panels are rendered from SDK gate results.</p><ul><li>Feature: ${state(snapshot.newDashboard)}</li><li>Negated feature: ${state(snapshot.dashboardNegated)}</li><li>Variant: <code>${snapshot.variant}</code></li><li>All keys: ${state(snapshot.allGate)}</li><li>Any key: ${state(snapshot.anyGate)}</li></ul></section>
    <section id="api"><h2>3. Programmatic API</h2><p><code>isFeatureOn</code>, <code>evaluateFeatureGate</code>, <code>getVariant</code>, and <code>refresh</code> are used directly.</p><button id="refresh">Refresh definitions</button><span id="refresh-status"></span></section>
    <section id="identity"><h2>4. Identity</h2><p>Identity is stored in <code>sessionStorage</code> for this browser tab, then applied explicitly with <code>setContext</code>. It is never shared across server requests or browser tabs.</p><label>Identity <input id="identity" value="${sessionStorage.getItem('sample-identity') ?? preset.identity}"></label><label>Role <select id="role"><option ${preset.claims.role === 'admin' ? 'selected' : ''}>admin</option><option ${preset.claims.role === 'user' ? 'selected' : ''}>user</option></select></label><button id="apply-identity">Apply identity and reload definitions</button></section>
    <section id="entity"><h2>5. Entity context</h2><p><code>Order</code> <code>${preset.orderId}</code>, <code>Vip=${preset.vip}</code> → ExpressCheckout ${state(orderOn)}</p></section>
    <section id="filters"><h2>6. Filters matrix</h2><button id="matching">Matching preset</button> <button id="nonmatching">Non-matching preset</button><p>Active preset: <strong>${preset.identity === 'alice' ? 'Matching' : 'Non-matching'}</strong></p><table><tr><th>Input</th><th>Value</th><th>SDK support in this browser sample</th></tr>
      <tr><td>Identity / claims</td><td>${preset.identity}; role=${preset.claims.role}</td><td>Applied with <code>setContext</code>; worker evaluated after refresh</td></tr><tr><td>Order</td><td>${preset.orderId}; Vip=${preset.vip}</td><td>Per-evaluation entity context</td></tr><tr><td>Country</td><td>${preset.country}</td><td>Display only: browser SDK has no per-call country override</td></tr><tr><td>Accept-Language</td><td>${preset.acceptLanguage}</td><td>Display only: browser controls the actual request header</td></tr><tr><td>User-Agent</td><td>${preset.userAgent}</td><td>Display only: browser controls the actual request header</td></tr></table><p class="muted">Because country, language, browser, device, and OS cannot be overridden per evaluation, this sample reports their actual returned flag values without claiming the preset forced them. Percentage remains sticky by identity.</p></section>
    <section id="unique"><h2>7. Package-unique surfaces</h2><p>Vanilla SDK surfaces demonstrated here: live WebSocket refresh when configured, optional variants, local defaults for offline startup, context registration, and direct DOM rendering.</p></section>
    <section id="configuration"><h2>8. Configuration</h2><p>${configured ? `Live app key is configured for <code>${import.meta.env.VITE_TOGGLY_ENVIRONMENT || 'Production'}</code>.` : 'The missing-key banner is visible and the app remains usable in offline placeholder mode.'}</p></section>
  </main>`
  document.querySelector('#matching')?.addEventListener('click', () => { preset = matchingPreset; render() })
  document.querySelector('#nonmatching')?.addEventListener('click', () => { preset = nonMatchingPreset; render() })
  document.querySelector('#refresh')?.addEventListener('click', async () => { const el = document.querySelector('#refresh-status')!; el.textContent = ' refreshing…'; await Toggly.refresh(); el.textContent = Toggly.lastError ? ` ${Toggly.lastError}` : ' refreshed'; render() })
  document.querySelector('#apply-identity')?.addEventListener('click', async () => { const identity = (document.querySelector<HTMLInputElement>('#identity')!).value.trim(); const role = (document.querySelector<HTMLSelectElement>('#role')!).value; sessionStorage.setItem('sample-identity', identity); preset = { ...preset, identity, claims: { role } }; await Toggly.setContext({ identity, claims: { role } }); render() })
}
render()
