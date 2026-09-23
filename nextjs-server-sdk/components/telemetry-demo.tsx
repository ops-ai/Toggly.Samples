'use client'

import { useState } from 'react'
import { useToggly } from '@ops-ai/nextjs-toggly-client'

export function TelemetryDemo() {
  const { telemetry, isFeatureOn, init, isLoading, isReady } = useToggly()
  const [collect, setCollect] = useState(process.env.NEXT_PUBLIC_TOGGLY_ENABLE_TELEMETRY !== 'false')
  const [decision, setDecision] = useState<boolean | null>(null)
  const [status, setStatus] = useState('No demo events recorded.')
  const [busy, setBusy] = useState(false)
  const variant = decision ? 'enabled' : 'disabled'

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
              await init({ enableTelemetry: enabled })
              setCollect(enabled)
            }, enabled ? 'Collection is on.' : 'Collection is off.')
          }} /> Collect browser telemetry
      </label>
      <p>Feature: <code>new-dashboard</code>. Last evaluation: {decision === null ? 'not evaluated' : variant}</p>
      <fieldset disabled={busy || isLoading || !isReady}>
        <legend>Explicit browser interactions</legend>
        <button type="button" onClick={() => void run(async () => {
          setDecision(await isFeatureOn('new-dashboard'))
        }, 'Feature evaluated.')}>Evaluate feature</button>{' '}
        <button type="button" disabled={decision === null} onClick={() => void run(() => telemetry.recordUsage('new-dashboard', variant), 'Usage recorded.')}>Record usage</button>{' '}
        <button type="button" disabled={decision === null} onClick={() => void run(() => telemetry.recordView('new-dashboard', variant), 'View recorded.')}>Record view</button>{' '}
        <button type="button" onClick={() => void run(() => telemetry.incrementCounter('sample-interactions', 1), 'Counter incremented.')}>Increment counter</button>{' '}
        <button type="button" onClick={() => void run(() => telemetry.setGauge('sample-cart-value', 42), 'Gauge set to 42.')}>Set gauge</button>{' '}
        <button type="button" onClick={() => void run(() => telemetry.flushTelemetry(), 'Flush attempted; delivery and aggregation are not guaranteed.')}>Flush telemetry</button>
      </fieldset>
      <p role="status">{status}</p>
      <p className="muted">Evaluation records a check automatically. Usage and view events happen only when you click their buttons; rendering this page records neither. Turning collection off discards pending telemetry for this owner. Feature evaluation remains available.</p>
    </section>
  )
}
