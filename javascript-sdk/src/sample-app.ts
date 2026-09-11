import { createSnapshot, matchingPreset, nonMatchingPreset, type FlagReader } from './demo'

export type EvaluationContext = { identity?: string; claims?: Record<string, string>; groups?: string[] }
// A narrow boundary for this view and its tests, not a replacement SDK.
// The shipped browser gate API uses numeric all=0 / any=1 requirements.
export type SampleSdk = {
  isFeatureOn(key: string, context?: Record<string, unknown>, kind?: string): boolean
  evaluateFeatureGate(keys: string[], requirement?: 0 | 1, negate?: boolean): boolean
  getVariant(key: string): { name: string; configurationValue?: unknown } | null
  refresh(): Promise<Record<string, boolean>>
  setContext(context: EvaluationContext): Promise<Record<string, boolean>>
  readonly evaluationContext: EvaluationContext
  readonly lastError?: string
}

type Preset = typeof matchingPreset
type Options = { configured: boolean; environment?: string }
const keys = ['new-dashboard','api-v2','enhanced-submit','ExpressCheckout','beta-access','filter-always-on','filter-percentage','filter-targeting','filter-user-claims','filter-time-window','filter-country','filter-browser-family','filter-browser-language','filter-device-type','filter-os','filter-context-property']

export function mountSample(root: Element, sdk: SampleSdk, options: Options) {
  let preset: Preset = matchingPreset
  let pending = false
  let runtimeError = ''
  const errorMessage = () => sdk.lastError || runtimeError
  let status = options.configured ? (errorMessage() ? `Live evaluation unavailable or cached: ${errorMessage()}` : 'Live definitions loaded.') : 'Offline placeholder mode. No Toggly network request is made.'
  const text = (selector: string, value: unknown) => { const node = root.querySelector(selector); if (node) node.textContent = String(value) }
  const flag = (selector: string, enabled: boolean) => { const node = root.querySelector(selector); if (node) { node.textContent = enabled ? 'ON' : 'OFF'; node.className = enabled ? 'on' : 'off' } }

  // setContext changes the user used by worker evaluation and awaits a reload.
  // It patches supplied fields, so omitted groups remain in the SDK context.
  // Unlike the per-order argument below, this context survives page reloads and
  // can affect other tabs on the same origin. Requested input and active SDK
  // context are displayed separately so a preset is not mistaken for proof.
  async function applyPreset(next: Preset) {
    preset = next; pending = true; status = `Applying ${next.identity} / role=${next.claims.role}…`; render()
    await sdk.setContext({ identity: next.identity, claims: next.claims })
    pending = false; status = errorMessage() ? `Evaluation unavailable or cached: ${errorMessage()}` : `Applied ${next.identity} / role=${next.claims.role}.`; render()
  }
  // refresh may resolve with last-known-good/cached data while recording
  // lastError. Catch alone is insufficient to label a result as freshly fetched.
  async function refresh() {
    pending = true; status = 'Refreshing definitions…'; render()
    try { await sdk.refresh(); runtimeError = '' } catch (error) { runtimeError = error instanceof Error ? error.message : String(error) }
    pending = false; status = errorMessage() ? `Evaluation unavailable or cached: ${errorMessage()}` : 'Definitions refreshed.'; render()
  }

  function render() {
    // Keep readable all/any names in our teaching helper, adapting them to the
    // numeric public API here. No FeatureRequirement global is exported by 1.7.4.
    const reader: FlagReader = { isFeatureOn: (key, context, kind) => sdk.isFeatureOn(key, context, kind), evaluateFeatureGate: (gate, requirement, negate) => sdk.evaluateFeatureGate(gate, requirement === 'any' ? 1 : 0, negate), getVariant: key => sdk.getVariant(key) }
    const snapshot = createSnapshot(reader)
    // The same user can have two orders with different results. Supply Order
    // for each evaluation so returned ContextProperty rules can read Vip locally.
    // A rule object without its entity fails closed; treating it as a truthy
    // boolean would incorrectly enable a feature. Plain offline booleans have
    // no rules to evaluate and therefore do not respond to changing the order.
    const expressCheckout = sdk.isFeatureOn('ExpressCheckout', preset, 'Order')
    const entityFilter = sdk.isFeatureOn('filter-context-property', preset, 'Order')
    // Variants are named assignments (with optional configuration), distinct
    // from ON/OFF. Null means use the explicit default-content branch below.
    const variant = sdk.getVariant('new-dashboard')
    const actual = sdk.evaluationContext
    const resultLabel = !options.configured ? 'offline placeholder' : errorMessage() ? 'unavailable or cached' : 'live'
    // These UI branches teach conditional presentation, not access control.
    // A user can change browser code or claims; protect privileged work on a server.
    root.innerHTML = `<main><h1>JavaScript SDK Sample</h1><p class="lede">A vanilla TypeScript showcase for <code>@ops-ai/feature-flags-toggly</code>.</p><div id="missing-key" class="banner"><strong>Missing app key.</strong> Set <code>VITE_TOGGLY_APP_KEY</code> in <code>.env.local</code>. Current values are offline placeholders.</div><div id="evaluation-status" class="status" aria-live="polite"></div><nav>${['home','gates','api','identity-section','entity','filters','unique','configuration'].map(name => `<a href="#${name}">${name}</a>`).join('')}</nav>
    <section id="home"><h2>1. Home</h2><p>Flag checklist and <strong id="result-label"></strong> snapshot.</p><div id="flag-grid" class="grid"></div></section>
    <section id="gates"><h2>2. Declarative gates</h2><p>DOM content is conditionally rendered from SDK gate results.</p><div id="feature-content" class="card"></div><div id="negated-content" class="card"></div><div id="variant-content" class="card"></div><ul><li>All keys: <strong id="all-gate"></strong></li><li>Any key: <strong id="any-gate"></strong></li></ul></section>
    <section id="api"><h2>3. Programmatic API</h2><p><code>isFeatureOn</code>, <code>evaluateFeatureGate</code>, <code>getVariant</code>, and <code>refresh</code>.</p><button id="refresh">Refresh definitions</button></section>
    <section id="identity-section"><h2>4. Identity</h2><p>The published SDK stores identity and claims in origin-wide <code>localStorage</code>. This actual evaluated context may be shared by tabs on this origin.</p><p>Evaluated identity: <code id="actual-identity"></code>; role: <code id="actual-role"></code></p><label>Identity <input id="identity-input"></label><label>Role <select id="role-input"><option>admin</option><option>user</option></select></label><button id="apply-identity">Apply identity and reload definitions</button></section>
    <section id="entity"><h2>5. Entity context</h2><p><code>Order</code> <code id="order-id"></code>, <code id="order-vip"></code> → ExpressCheckout <strong id="express-checkout"></strong>; ContextProperty <strong id="entity-filter"></strong></p></section>
    <section id="filters"><h2>6. Filters matrix</h2><button id="matching">Matching preset</button> <button id="nonmatching">Non-matching preset</button><p>Requested preset: <strong id="preset-name"></strong> <span id="preset-pending"></span></p><table><tr><th>Input</th><th>Requested value</th><th>Evaluation status</th></tr><tr><td>Identity / claims</td><td id="requested-context"></td><td id="active-context"></td></tr><tr><td>Order</td><td id="requested-order"></td><td>Per-evaluation Order context; result shown above</td></tr><tr><td>Country</td><td id="country"></td><td>Display only: no per-call override</td></tr><tr><td>Accept-Language</td><td id="language"></td><td>Display only: browser controls request header</td></tr><tr><td>User-Agent</td><td id="user-agent"></td><td>Display only: browser controls request header</td></tr></table><p class="muted">Browser, language, device, OS, and country rows show actual returned flags; presets cannot force those request properties. Percentage is sticky by SDK identity.</p></section>
    <section id="unique"><h2>7. Package-unique surfaces</h2><p>Browser global, supported refresh hook, WebSocket refresh, variants, offline defaults, and entity registration.</p></section><section id="configuration"><h2>8. Configuration</h2><p id="configuration-text"></p></section></main>`
    if (options.configured) root.querySelector('#missing-key')?.remove()
    text('#evaluation-status', status); text('#result-label', resultLabel)
    // Filter rows are SDK results, not local comparisons against preset strings.
    // Targeting/claims/percentage/time/request filters need live definitions;
    // country, browser, language, device and OS follow the real request context.
    const grid = root.querySelector('#flag-grid')!
    for (const key of keys) { const card = document.createElement('div'); card.className = 'card'; const code = document.createElement('code'); code.textContent = key; const value = document.createElement('strong'); value.dataset.flag = key; const enabled = key === 'filter-context-property' ? entityFilter : sdk.isFeatureOn(key); value.textContent = enabled ? 'ON' : 'OFF'; value.className = enabled ? 'on' : 'off'; card.append(code, document.createElement('br'), value); grid.append(card) }
    text('#feature-content', snapshot.newDashboard ? 'New dashboard content is visible.' : 'New dashboard content is hidden.'); text('#negated-content', snapshot.dashboardNegated ? 'Classic dashboard fallback is visible.' : 'Classic dashboard fallback is hidden.')
    text('#variant-content', variant ? `Variant “${variant.name}” content: ${JSON.stringify(variant.configurationValue ?? 'no configuration')}` : 'No variant assigned; default dashboard content is shown.')
    flag('#all-gate', snapshot.allGate); flag('#any-gate', snapshot.anyGate)
    const identityInput = root.querySelector<HTMLInputElement>('#identity-input')!; identityInput.value = actual.identity ?? ''
    const roleInput = root.querySelector<HTMLSelectElement>('#role-input')!; roleInput.value = actual.claims?.role ?? 'user'
    text('#actual-identity', actual.identity ?? '(anonymous)'); text('#actual-role', actual.claims?.role ?? '(none)'); text('#order-id', preset.orderId); text('#order-vip', `Vip=${preset.vip}`); flag('#express-checkout', expressCheckout); flag('#entity-filter', entityFilter)
    text('#preset-name', preset === matchingPreset ? 'Matching' : 'Non-matching'); text('#preset-pending', pending ? '(pending refresh)' : ''); text('#requested-context', `${preset.identity}; role=${preset.claims.role}`); text('#active-context', `${actual.identity ?? '(anonymous)'}; role=${actual.claims?.role ?? '(none)'}`); text('#requested-order', `${preset.orderId}; Vip=${preset.vip}`); text('#country', preset.country); text('#language', preset.acceptLanguage); text('#user-agent', preset.userAgent)
    text('#configuration-text', options.configured ? `App key configured for ${options.environment ?? 'Production'}; see status above for fetch outcome.` : 'Missing key: usable offline placeholder mode with live updates and persistence disabled.')
    root.querySelector('#matching')?.addEventListener('click', () => void applyPreset(matchingPreset)); root.querySelector('#nonmatching')?.addEventListener('click', () => void applyPreset(nonMatchingPreset)); root.querySelector('#refresh')?.addEventListener('click', () => void refresh())
    root.querySelector('#apply-identity')?.addEventListener('click', () => { const identity = root.querySelector<HTMLInputElement>('#identity-input')!.value.trim(); const role = root.querySelector<HTMLSelectElement>('#role-input')!.value; void applyPreset({ ...preset, identity, claims: { role } }) })
  }
  function onRefresh() { status = errorMessage() ? `Live update unavailable or cached: ${errorMessage()}` : 'Live update received.'; render() }
  return { render, onRefresh }
}
