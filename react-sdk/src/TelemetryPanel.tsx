import { useState } from 'react'
import { useTogglyService } from './toggly'

export function TelemetryPanel({ enabled }: { enabled: boolean }) {
  const toggly = useTogglyService()
  const [decision, setDecision] = useState<boolean | null>(null)
  const [variant, setVariant] = useState('disabled')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('No explicit demo events recorded.')

  async function run(action: () => void | Promise<void>, message: string) {
    setBusy(true)
    try {
      await action()
      setStatus(message)
    } catch {
      setStatus('Operation failed. Check the SDK connection and configuration.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="card" id="telemetry">
    <h2>Browser telemetry</h2>
    <p>{enabled ? 'Collection is on.' : 'Collection is off.'} Set <code>VITE_TOGGLY_ENABLE_TELEMETRY=false</code> and restart/rebuild to opt out. Without a key the provider stays local and sends no telemetry.</p>
    <p>Last evaluation: {decision === null ? 'not evaluated' : decision ? 'enabled' : 'disabled'}</p>
    {decision !== null && <p>Recorded variant: <code>{variant}</code></p>}
    <fieldset disabled={!toggly || busy}>
      <legend>Explicit interactions for new-dashboard</legend>
      <button type="button" onClick={() => void run(async () => {
        const result = await toggly!.isFeatureOn('new-dashboard')
        setDecision(result)
        setVariant(result ? 'enabled' : 'disabled')
      }, 'Feature evaluated.')}>Evaluate telemetry feature</button>
      <button type="button" disabled={decision === null} onClick={() => void run(() => toggly!.recordUsage('new-dashboard', variant), 'Usage recorded.')}>Record usage</button>
      <button type="button" disabled={decision === null} onClick={() => void run(() => toggly!.recordView('new-dashboard', variant), 'View recorded.')}>Record view</button>
      <button type="button" onClick={() => void run(() => toggly!.incrementCounter('sample-actions', 1), 'Counter incremented.')}>Increment counter</button>
      <button type="button" onClick={() => void run(() => toggly!.setGauge('sample-cart-size', 3), 'Gauge set to 3.')}>Set gauge</button>
      <button type="button" onClick={() => void run(() => toggly!.flushTelemetry(), 'Flush attempted; delivery and aggregation are not guaranteed.')}>Flush telemetry</button>
    </fieldset>
    <p role="status">{status}</p>
    <p className="muted">This panel labels explicit events enabled/disabled; named experiment assignments remain in React surfaces. Evaluations across the showcase record checks automatically. Usage and view events occur only on their buttons, never from rendering this panel. Configure the sample-actions counter and sample-cart-size gauge in your sample application before expecting aggregated metrics.</p>
  </section>
}
