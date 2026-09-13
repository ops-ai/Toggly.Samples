import { useEffect, useMemo, useState } from 'react'
import { Feature, useFeatureFlag, useFeatureGate } from '@ops-ai/electron-feature-flags-toggly/react'
import { evaluateFeatureGate, isFeatureOn } from '@ops-ai/electron-feature-flags-toggly'
import {
  buildOrderContext,
  coreFlags,
  filterCapabilities,
  filterFlags,
  filterPreset,
  filterResult,
  type PresetName,
} from './demo-model'

type Flags = Record<string, boolean>

function useLiveFlags(): Flags {
  const [flags, setFlags] = useState<Flags>({})

  useEffect(() => {
    // getFlags is async because it crosses the secure preload boundary. The
    // listener makes the snapshot react to main-process refresh/WebSocket events.
    void window.toggly?.getFlags().then(setFlags).catch(() => setFlags({}))
    return window.toggly?.onFlagsUpdated(setFlags)
  }, [])

  return flags
}

function FlagPill({ name, value }: { name: string; value: boolean | undefined }) {
  return <span className={value ? 'pill on' : 'pill off'}>{name}: {value ? 'ON' : 'OFF'}</span>
}

export function App() {
  const flags = useLiveFlags()
  const [identity, setIdentity] = useState('anonymous')
  const [role, setRole] = useState('user')
  const [preset, setPreset] = useState<PresetName>('matching')
  const [vip, setVip] = useState(true)
  const [notice, setNotice] = useState('Choose a session identity, then apply it to refresh the main-process evaluation context.')
  const dashboard = useFeatureFlag('new-dashboard')
  const legacyApi = useFeatureFlag('api-v2', { negate: true })
  const allCore = useFeatureGate(['new-dashboard', 'api-v2'], { requirement: 'all' })
  const anyCore = useFeatureGate(['new-dashboard', 'api-v2'], { requirement: 'any' })
  const order = useMemo(() => buildOrderContext(vip), [vip])
  const expressCheckout = useFeatureFlag('ExpressCheckout', { context: order })
  // Unlike getFlags(), this call carries the selected Order. It therefore
  // exercises the live ContextProperty rule instead of showing its global
  // snapshot, which has no Order.Vip value to evaluate against.
  const contextPropertyFilter = useFeatureFlag('filter-context-property', { context: order })

  const applySession = async (nextIdentity = identity, nextRole = role): Promise<void> => {
    // This call refreshes definitions because identity/claims participate in the
    // evaluated-signed request. It changes the desktop application's singleton
    // context, deliberately only from an explicit user session action.
    await window.toggly?.setContext({ identity: nextIdentity, claims: { role: nextRole } })
    setIdentity(nextIdentity)
    setRole(nextRole)
    setNotice(`Desktop session context applied: ${nextIdentity}, role=${nextRole}.`)
  }

  const applyPreset = async (name: PresetName): Promise<void> => {
    const next = filterPreset(name)
    setPreset(name)
    setVip(next.vip)
    await applySession(next.identity, next.role)
    setNotice(`${name === 'matching' ? 'Matching' : 'Non-matching'} preset applied. Header-derived rows remain unavailable to this SDK bridge.`)
  }

  const clearSession = async (): Promise<void> => {
    await window.toggly?.clearContext()
    setIdentity('anonymous')
    setRole('user')
    setNotice('The SDK generated a new anonymous desktop context and refreshed the flag snapshot.')
  }

  return <main>
    <header>
      <p className="eyebrow">Toggly Electron SDK · secure main → preload → React renderer</p>
      <h1>Feature flags for a desktop app</h1>
      <p>A feature flag is a named decision. Toggly evaluates its rules and this React interface chooses the matching UI branch. A flag is useful for rollout and experiments; it is not authorization.</p>
      <nav>{['home', 'declarative', 'programmatic', 'identity', 'entity', 'filters', 'electron', 'configuration'].map(id => <a key={id} href={`#${id}`}>{id}</a>)}</nav>
    </header>

    {!window.sampleConfiguration.hasAppKey && <aside className="banner"><strong>Missing App Key.</strong> The main process uses safe OFF defaults and makes no definitions request. Copy <code>.env.example</code> to <code>.env.local</code>; the key never enters this renderer bundle.</aside>}

    <section id="home">
      <h2>1. Home: follow one decision</h2>
      <ol><li>The dashboard stores a rule for a flag key such as <code>new-dashboard</code>.</li><li>Main initializes Toggly before it creates this window.</li><li>Preload exposes a narrow bridge; React reads only decisions, never the App Key.</li><li>UI renders the ON or OFF branch below.</li></ol>
      <div className="panel"><h3>First toggle: new-dashboard</h3><p>{dashboard.isEnabled ? 'Dashboard v2 is enabled for this evaluated context.' : 'Classic dashboard is shown because new-dashboard is OFF or uses its safe default.'}</p><Feature featureKey="new-dashboard" loading={<p>Checking the main-process bridge…</p>}><strong className="success">New dashboard content</strong></Feature></div>
      <h3>Live snapshot</h3><div className="pills">{[...coreFlags, ...filterFlags].map(key => <FlagPill key={key} name={key} value={flags[key]} />)}</div>
    </section>

    <section id="declarative">
      <h2>2. Declarative React gates</h2>
      <p><code>Feature</code> is a React component from the published SDK. It listens for main-process flag updates and renders its children only when the gate succeeds.</p>
      <div className="grid">
        <div className="panel"><h3>Feature</h3><Feature featureKey="new-dashboard"><p className="success">new-dashboard allowed this content.</p></Feature><p>{dashboard.isEnabled ? 'ON branch' : 'OFF branch'}</p></div>
        <div className="panel"><h3>Negate</h3><p>{legacyApi.isEnabled ? 'Legacy API content shows while api-v2 is OFF.' : 'api-v2 is ON, so the legacy content is hidden.'}</p></div>
        <div className="panel"><h3>Multi-key</h3><p>All: {allCore.isEnabled ? 'ON' : 'OFF'} · Any: {anyCore.isEnabled ? 'ON' : 'OFF'}</p><Feature featureKeys={['new-dashboard', 'api-v2']} requirement="any"><p className="success">At least one dashboard/API decision is enabled.</p></Feature></div>
      </div>
      <p className="caveat"><strong>Variant limitation:</strong> Electron SDK 1.0.0 publishes boolean flags and gates, but no named-variant or experiment-assignment API. The dashboard labels in this sample are boolean UI branches, not an A/B assignment.</p>
    </section>

    <section id="programmatic">
      <h2>3. Programmatic API</h2>
      <p>Use the renderer helpers when a decision belongs in ordinary application logic. They synchronously call the narrow bridge and fail closed when preload is absent.</p>
      <div className="panel"><p><code>isFeatureOn('enhanced-submit')</code>: <strong>{isFeatureOn('enhanced-submit') ? 'ON' : 'OFF'}</strong></p><p><code>evaluateFeatureGate(['new-dashboard', 'api-v2'], 'any')</code>: <strong>{evaluateFeatureGate(['new-dashboard', 'api-v2'], 'any') ? 'ON' : 'OFF'}</strong></p><p>Keep security decisions on a trusted service: a person can inspect or modify desktop UI, even when a feature gate hides a button.</p></div>
    </section>

    <section id="identity">
      <h2>4. Explicit desktop session identity</h2>
      <p>Unlike a web server, Electron main is a long-lived singleton. The bridge’s <code>setContext</code> changes its current desktop session and triggers a refresh; it is not request-scoped. A production app should derive this from its authenticated account lifecycle, clear it on sign-out, and avoid letting untrusted page input choose an identity.</p>
      <div className="controls"><label>Identity <input value={identity} onChange={event => setIdentity(event.target.value)} /></label><label>Role <select value={role} onChange={event => setRole(event.target.value)}><option value="user">user</option><option value="admin">admin</option></select></label><button onClick={() => void applySession()}>Apply session</button><button onClick={() => void clearSession()}>Clear session</button></div><p className="notice">{notice}</p>
    </section>

    <section id="entity">
      <h2>5. Entity context: Order VIP</h2>
      <p>The <code>ExpressCheckout</code> decision receives an Order only for this evaluation. The SDK recognizes the published <code>{'{ kind, key, attributes }'}</code> entity shape; <code>Vip</code> and optional <code>Total</code> live in its attributes. This avoids changing the desktop identity to test an order.</p>
      <div className="controls"><button onClick={() => setVip(true)}>Use VIP order</button><button onClick={() => setVip(false)}>Use standard order</button><code>{JSON.stringify(order)}</code></div><p>Express checkout: <strong>{expressCheckout.isEnabled ? 'ON — show expedited checkout.' : 'OFF — show standard checkout.'}</strong></p>
    </section>

    <section id="filters">
      <h2>6. Filters matrix</h2>
      <p>The controls send supported identity/claims inputs through the bridge and use the selected Order on the entity call. They intentionally do not claim that a desktop process can create HTTP country, User-Agent, or Accept-Language targeting inputs.</p>
      <div className="controls"><button onClick={() => void applyPreset('matching')}>Apply Matching preset</button><button onClick={() => void applyPreset('non-matching')}>Apply Non-matching preset</button><span>Active: {preset}</span></div>
      <p>Matching: alice / admin / US / English / Chrome on macOS / VIP. Non-matching: bob / user / CA / French / Firefox on Windows / standard Order.</p>
      <table><thead><tr><th>Flag</th><th>Expected input</th><th>Electron 1.0.0</th><th>Live result</th></tr></thead><tbody>{filterCapabilities.map(([key, input, support]) => <tr key={key}><td><code>{key}</code></td><td>{input}</td><td>{support}</td><td>{support === 'Supported' || support === 'Supported per evaluation' ? (filterResult(key, flags, contextPropertyFilter.isEnabled) ? 'ON' : 'OFF') : 'Not evaluated by this bridge'}</td></tr>)}</tbody></table>
      <p className="caveat">Percentage is sticky by identity, so a 50% rollout has no prescribed ON/OFF result. AlwaysOn and an open TimeWindow remain ON when configured. The ContextProperty row evaluates the selected Order; header-derived rows remain visible as setup guidance, but the Electron API does not expose their inputs.</p>
    </section>

    <section id="electron">
      <h2>7. Electron-specific surfaces</h2>
      <div className="grid"><div className="panel"><h3>Main owns configuration</h3><p>It reads <code>TOGGLY_APP_KEY</code>, initializes once before windows, verifies signed definitions when configured, stores last-known-good definitions under Electron <code>userData</code>, and owns refresh/WebSocket work.</p></div><div className="panel"><h3>Preload narrows capability</h3><p><code>exposeToggly()</code> uses contextBridge. Renderer code can ask for flag values, set the explicit session context, and subscribe to updates; it cannot call arbitrary IPC or read the key.</p></div><div className="panel"><h3>Updates fan out</h3><p>The SDK sends a new flag snapshot to every open window after a refresh. React hooks and <code>Feature</code> re-evaluate, keeping UI consistent without exposing transport details.</p></div></div>
    </section>

    <section id="configuration">
      <h2>8. Configuration and failure behavior</h2>
      <p>{window.sampleConfiguration.hasAppKey ? `A key is configured for ${window.sampleConfiguration.environment}. Initialisation may still use cached/default values if fetch or signature verification fails.` : 'No configured key: this is a deliberate offline/default mode, not a connection error.'}</p><p>Definitions are public configuration for the selected app, but dashboard management credentials are secrets and must never ship. The app key is held in main and the displayed configuration is only a boolean status.</p>
    </section>
  </main>
}
