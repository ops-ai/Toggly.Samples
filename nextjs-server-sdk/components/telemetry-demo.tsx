'use client'

import { useState } from 'react'
import { useToggly } from '@ops-ai/nextjs-toggly-client'

export function TelemetryDemo() {
  const { telemetry, isFeatureOn, init, isLoading, isReady, identity, features, client } = useToggly()
  const [collect, setCollect] = useState(process.env.NEXT_PUBLIC_TOGGLY_ENABLE_TELEMETRY !== 'false')
  const [selection, setSelection] = useState<{ value: boolean; identity: string | undefined; snapshot: boolean | undefined } | null>(null)
  const [status, setStatus] = useState('No demo events recorded.')
  const [busy, setBusy] = useState(false)
  const decision = selection && selection.identity === identity && selection.snapshot === features['new-dashboard']
    ? selection.value : null
  const variant = decision ? 'enabled' : 'disabled'

  function recordSelected(kind: 'usage' | 'view') {
    // A refresh can land between render and click; never attribute an old choice.
    if (decision === null || !selection || client.identity !== selection.identity ||
      client.state.features['new-dashboard'] !== selection.snapshot) {
      setSelection(null)
      throw new Error('Feature selection changed before the event was recorded')
    }
    if (kind === 'usage') telemetry.recordUsage('new-dashboard', variant)
    else telemetry.recordView('new-dashboard', variant)
  }

  async function run(action: () => void | Promise<void>, message: string) {
    setBusy(true)
    try {
      await action()
      setStatus(message)
    } catch {
      setStatus('The operation failed. Check the client connection and configuration.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" aria-label="Telemetry controls">
      <label>
        <input type="checkbox" checked={collect} disabled={busy || isLoading || !isReady}
          onChange={event => {
            const enabled = event.target.checked
            void run(async () => {
              // Reconfigure this provider's owner; never create a second reporter.
              setSelection(null)
              await init({ enableTelemetry: enabled })
              setCollect(enabled)
            }, enabled ? 'Collection is on.' : 'Collection is off.')
          }} /> Collect browser telemetry
      </label>
      <p>Feature: <code>new-dashboard</code>. Last evaluation: {decision === null ? 'not evaluated' : variant}</p>
      <fieldset disabled={busy || isLoading || !isReady}>
        <legend>Explicit browser interactions</legend>
        <button type="button" onClick={() => void run(async () => {
          setSelection(null)
          const value = await isFeatureOn('new-dashboard')
          const snapshot = client.state.features['new-dashboard']
          setSelection({ value, identity: client.identity, snapshot: typeof snapshot === 'boolean' ? snapshot : undefined })
        }, 'Feature evaluated.')}>Evaluate feature</button>{' '}
        <button type="button" disabled={decision === null} onClick={() => void run(() => recordSelected('usage'), 'Usage recorded.')}>Record usage</button>{' '}
        <button type="button" disabled={decision === null} onClick={() => void run(() => recordSelected('view'), 'View recorded.')}>Record view</button>{' '}
        <button type="button" onClick={() => void run(() => telemetry.incrementCounter('sample-interactions', 1), 'Counter incremented.')}>Increment counter</button>{' '}
        <button type="button" onClick={() => void run(() => telemetry.setGauge('sample-cart-value', 42), 'Gauge set to 42.')}>Set gauge</button>{' '}
        <button type="button" onClick={() => void run(() => telemetry.flushTelemetry(), 'Flush attempted; delivery and aggregation are not guaranteed.')}>Flush telemetry</button>
      </fieldset>
      <p role="status">{status}</p>
      <p className="muted">Evaluation records a check automatically. Usage and view events happen only when you click their buttons; rendering this page records neither. Turning collection off discards pending telemetry for this owner. Feature evaluation remains available.</p>
    </section>
  )
}
