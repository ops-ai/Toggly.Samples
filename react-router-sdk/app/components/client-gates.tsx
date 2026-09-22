import { Feature, useABTest, useFeature, useToggly } from '@ops-ai/react-router-toggly/client'
import { useState } from 'react'

export function ClientGates() {
  const direct = useFeature('new-dashboard', false)
  const toggly = useToggly()
  const [actionStatus, setActionStatus] = useState('No explicit telemetry sent yet.')
  // The published client has useABTest, but it maps a boolean to labels. It
  // does not expose a dashboard experiment/variant assignment object.
  const booleanMappedLabel = useABTest('new-dashboard', 'classic', 'modern')
  return (
    <section>
      <h2>Browser package: declarative gates</h2>
      <p>These are presentation choices only. A server action must still enforce any authorization rule.</p>
      <Feature featureKey="new-dashboard"><p className="on">Feature: new dashboard is ON.</p></Feature>
      <Feature featureKey="new-dashboard" negate><p className="off">Negate: legacy dashboard is shown while the flag is OFF.</p></Feature>
      <Feature featureKeys={['new-dashboard', 'api-v2']} requirement="all">
        <p className="on">Multi-key all gate: both new-dashboard and api-v2 are on.</p>
      </Feature>
      <p>
        <b>Programmatic client hook:</b> <span data-testid="new-dashboard-result">{String(direct)}</span>; provider ready: {String(toggly.isReady)}; boolean-mapped “variant”: {booleanMappedLabel}.
      </p>
      <section aria-labelledby="browser-telemetry-heading">
        <h3 id="browser-telemetry-heading">App-owned browser telemetry</h3>
        <p>Browser identity: <span data-testid="client-identity">{toggly.identity || 'anonymous'}</span></p>
        <div className="actions">
          <button data-testid="identify-alice" onClick={() => void toggly.identify('alice', { groups: ['beta'], claims: { role: 'admin' } })}>Identify alice · beta/admin</button>
          <button data-testid="identify-bob" onClick={() => void toggly.identify('bob', { groups: [], claims: { role: 'user' } })}>Identify bob · user</button>
          <button
            data-testid="record-telemetry"
            onClick={() => {
              const variant = direct ? 'enabled' : 'disabled'
              toggly.recordUsage('new-dashboard', variant)
              toggly.recordView('new-dashboard', variant)
              toggly.incrementCounter('router-sample-actions', 1)
              toggly.setGauge('router-sample-cart-size', 3)
              void toggly.flushTelemetry().then(() => setActionStatus(`Sent explicit events for ${toggly.identity || 'anonymous'}.`))
            }}
          >Record usage, view and metrics</button>
          <button onClick={() => void toggly.refresh()}>Refresh browser flags</button>
        </div>
        <p role="status" data-testid="telemetry-status">{actionStatus}</p>
      </section>
    </section>
  )
}
