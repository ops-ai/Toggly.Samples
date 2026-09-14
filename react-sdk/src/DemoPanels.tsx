import { useState } from 'react'
import { Feature, useFeatureFlag, useFeatureGate, useVariant } from '@ops-ai/react-feature-flags-toggly'
import { filterRows } from './filter-catalog'
import type { Order } from './sample-config'
import { useProgrammaticFlag, useTogglyService } from './toggly'

const snapshotFlags = ['new-dashboard', 'api-v2', 'enhanced-submit', 'ExpressCheckout', 'beta-access']

function State({ enabled, loading }: { enabled: boolean; loading: boolean }) {
  return <span className={enabled ? 'on' : 'off'}>{loading ? 'loading…' : enabled ? 'on' : 'off'}</span>
}

export function DeclarativeGates() {
  const dashboard = useFeatureFlag('new-dashboard')
  const eitherApi = useFeatureGate(['new-dashboard', 'api-v2'], { requirement: 'any' })
  return <section className="card" id="declarative">
    <h2>Declarative gates</h2>
    <p>Use <code>&lt;Feature&gt;</code> when a whole element should appear or disappear. The SDK subscribes it to evaluated-definition refreshes, so no hand-written polling loop is needed.</p>
    <div className="demo-grid">
      <Feature featureKey="new-dashboard"><p className="on">new-dashboard is on: render the new dashboard card.</p></Feature>
      <Feature featureKey="new-dashboard" negate><p className="off">new-dashboard is off: this is the explicit legacy branch.</p></Feature>
      <Feature featureKey="new-dashboard" variant="treatment"><p className="on">Variant treatment: show this only when the assignment is treatment.</p></Feature>
      <Feature featureKeys={['new-dashboard', 'api-v2']} requirement="any"><p className="on">Multi-key any gate: one of new-dashboard or api-v2 is on.</p></Feature>
    </div>
    <p className="muted">Hook snapshot — new dashboard: <State enabled={dashboard.isEnabled} loading={dashboard.isLoading} />; any dashboard/API gate: <State enabled={eitherApi.isEnabled} loading={eitherApi.isLoading} />.</p>
  </section>
}

export function ProgrammaticApi() {
  const { enabled, loading, evaluate, toggly } = useProgrammaticFlag('api-v2')
  const [multiResult, setMultiResult] = useState<boolean | null>(null)
  async function evaluateAny() {
    // This is the service equivalent of <Feature featureKeys={...} requirement="any">.
    const result = await toggly?.evaluateFeatureGate(['new-dashboard', 'api-v2'], 'any', false)
    setMultiResult(result ?? false)
  }
  return <section className="card" id="programmatic">
    <h2>Programmatic API</h2>
    <p>Hooks and components cover UI gates. Call the service for an event handler or a value that must remain mounted, such as a disabled button.</p>
    <p><code>await toggly.isFeatureOn('api-v2')</code> → <State enabled={enabled} loading={loading} /></p>
    <button type="button" onClick={() => void evaluate()}>Re-evaluate api-v2</button>
    <button type="button" onClick={() => void evaluateAny()}>Evaluate new-dashboard OR api-v2</button>
    {multiResult !== null && <p>Multi-key result: <strong>{String(multiResult)}</strong></p>}
    <p className="muted">UI gates are presentation decisions. Protect an API or data access with server-side authorization too.</p>
  </section>
}

export function IdentityPanel({ initialIdentity }: { initialIdentity: string }) {
  const toggly = useTogglyService()
  const [identity, setIdentity] = useState(initialIdentity)
  const [role, setRole] = useState('admin')
  const [message, setMessage] = useState('The provider started with this tab identity.')
  async function applyIdentity() {
    if (!toggly) { setMessage('No provider service is available; add an app key to evaluate remotely.'); return }
    // Initial identity went into provider creation. This is only a later session change.
    await toggly.setContext({ identity, groups: ['beta'], claims: { role } })
    sessionStorage.setItem('toggly-react-sample.identity', identity)
    setMessage('Context changed and the SDK refreshed this identity’s definitions.')
  }
  return <section className="card" id="identity">
    <h2>Session identity</h2>
    <p>This browser-only sample stores an identity in <code>sessionStorage</code>. It is passed to <code>createTogglyProvider</code> before the first request; <code>setContext</code> is only for a later login, logout, role, or group change.</p>
    <label>Identity<input value={identity} onChange={(event) => setIdentity(event.target.value)} /></label>
    <label>Role claim<select value={role} onChange={(event) => setRole(event.target.value)}><option value="admin">admin (matching preset)</option><option value="user">user (non-matching preset)</option></select></label>
    <button type="button" onClick={() => void applyIdentity()}>Apply session context</button>
    <p className="muted">{message} This is client state, never a process-wide server identity.</p>
  </section>
}

function OrderCard({ order }: { order: Order }) {
  // The registered mapper converts this domain object on every individual check.
  const gate = useProgrammaticFlag('ExpressCheckout', order, 'Order')
  return <article className="inset">
    <h3>{order.id}</h3><p>Vip: <strong>{String(order.vip)}</strong>; Total: ${order.total?.toFixed(2) ?? '—'}</p>
    {/* The entity travels with this check; it does not overwrite user identity. */}
    <Feature featureKey="ExpressCheckout" context={order} contextKind="Order"><p className="on">Declarative entity gate: Express Checkout is available.</p></Feature>
    <p>Programmatic entity gate: <State enabled={gate.enabled} loading={gate.loading} /></p>
  </article>
}

export function OrderContextPanel() {
  return <section className="card" id="order">
    <h2>Order entity context</h2>
    <p><code>ExpressCheckout</code> is configured against the shared <code>Order.Vip</code> property. Each check receives a complete Order context, so one page can render a VIP and standard order independently.</p>
    <div className="demo-grid"><OrderCard order={{ id: 'ord-vip', vip: true, total: 149.95 }} /><OrderCard order={{ id: 'ord-standard', vip: false, total: 42 }} /></div>
  </section>
}

function FilterStatusRow({ flag }: { flag: string }) { const current = useProgrammaticFlag(flag); return <State enabled={current.enabled} loading={current.loading} /> }

export function FiltersMatrix() {
  const toggly = useTogglyService()
  const [preset, setPreset] = useState<'matching' | 'non-matching'>('matching')
  const [message, setMessage] = useState('Apply a preset after configuring the matching dashboard rules.')
  async function applyPreset(next: 'matching' | 'non-matching') {
    setPreset(next); const matching = next === 'matching'
    if (toggly) {
      // Country and user-agent are browser/network inputs, documented below rather than fabricated.
      await toggly.setContext({ identity: matching ? 'alice' : 'bob', groups: [], claims: { role: matching ? 'admin' : 'user' } })
    }
    setMessage(matching ? 'Applied alice + role=admin. Use a matching browser/network for header-derived rows.' : 'Applied bob + role=user. Header-derived rows depend on your actual browser/network.')
  }
  return <section className="card" id="filters">
    <h2>Filters matrix</h2>
    <p>The dashboard owns rule configuration; this sample sends only the browser SDK context the published package supports. Start with the shared flag recipe, then compare matching and non-matching results.</p>
    <div className="filter-presets"><button type="button" aria-pressed={preset === 'matching'} onClick={() => void applyPreset('matching')}>Apply matching preset</button><button type="button" aria-pressed={preset === 'non-matching'} onClick={() => void applyPreset('non-matching')}>Apply non-matching preset</button></div>
    <p className="muted">{message}</p>
    <div className="table-wrap"><table><thead><tr><th>Flag</th><th>Input</th><th>Matching</th><th>Non-matching</th><th>Current</th></tr></thead><tbody>{filterRows.map((row) => <tr key={row.key}><td><code>{row.key}</code>{row.limitation && <small>{row.limitation}</small>}</td><td>{row.input}</td><td>{row.matching}</td><td>{row.nonMatching}</td><td><FilterStatusRow flag={row.key} /></td></tr>)}</tbody></table></div>
  </section>
}

function SnapshotRow({ flag }: { flag: string }) { const current = useProgrammaticFlag(flag); return <li><code>{flag}</code> <State enabled={current.enabled} loading={current.loading} /></li> }
export function Snapshot() { return <section className="card" id="snapshot"><h2>Live flag snapshot</h2><p>Each row evaluates through the service and subscribes to definition refreshes.</p><ul className="snapshot">{snapshotFlags.map((flag) => <SnapshotRow flag={flag} key={flag} />)}</ul></section> }

export function ReactSurfaces() {
  const variant = useVariant('new-dashboard')
  return <section className="card" id="surfaces">
    <h2>React SDK surfaces</h2>
    <p>This package pairs declarative components with hooks and a provider context. It can also request evaluated variants when <code>enableVariants</code> is configured during provider creation.</p>
    <Feature featureKey="enhanced-submit" render={(enabled) => <button type="button" disabled={!enabled}>{enabled ? 'Enhanced submit available' : 'Enhanced submit is gated'}</button>} />
    <p>new-dashboard variant: <code>{variant?.name ?? 'no assignment'}</code></p>
    <p className="muted">A variant assignment is separate from a boolean branch; configure a variant in the dashboard to observe it here.</p>
  </section>
}
