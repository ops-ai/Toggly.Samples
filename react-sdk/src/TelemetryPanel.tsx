import { useEffect, useRef, useState } from 'react'
import type { TogglyService } from '@ops-ai/react-feature-flags-toggly'
import { subscribeSampleContextChanges, useTogglyService } from './toggly'

export function TelemetryPanel({ enabled }: { enabled: boolean }) {
  const toggly = useTogglyService()
  const [selection, setSelection] = useState<{ owner: TogglyService; generation: number; enabled: boolean } | null>(null)
  const generation = useRef(0)
  const operation = useRef(0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('No explicit demo events recorded.')
  const valid = selection?.owner === toggly && selection?.generation === generation.current ? selection : null
  const decision = valid?.enabled ?? null
  const variant = decision ? 'enabled' : 'disabled'

  useEffect(() => {
    const invalidate = () => {
      generation.current++
      operation.current++
      setSelection(null)
      setBusy(false)
      setStatus('Evaluate again after context or feature definitions change.')
    }
    invalidate()
    if (!toggly) return undefined
    const unsubscribers = [
      subscribeSampleContextChanges(toggly, invalidate),
      toggly.subscribeFeaturesRefresh(invalidate),
      toggly.subscribeLocalGatesChanged(invalidate),
    ]
    return () => {
      generation.current++
      operation.current++
      unsubscribers.forEach(unsubscribe => unsubscribe())
    }
  }, [toggly])

  async function run(action: () => void | Promise<void>, message: string) {
    const current = ++operation.current
    setBusy(true)
    try {
      await action()
      if (current === operation.current) setStatus(message)
    } catch {
      if (current === operation.current) setStatus('Operation failed. Check the SDK connection and configuration.')
    } finally {
      if (current === operation.current) setBusy(false)
    }
  }

  function record(kind: 'recordUsage' | 'recordView') {
    // Recheck the generation in the handler as invalidation precedes rendering.
    if (valid && valid.generation === generation.current) toggly![kind]('new-dashboard', variant)
  }

  return <section className="card" id="telemetry">
    <h2>Browser telemetry</h2>
    <p>{enabled ? 'Collection is on.' : 'Collection is off.'} Set <code>VITE_TOGGLY_ENABLE_TELEMETRY=false</code> and restart/rebuild to opt out. Without a key the provider stays local and sends no telemetry.</p>
    <p>Last evaluation: {decision === null ? 'not evaluated' : decision ? 'enabled' : 'disabled'}</p>
    {decision !== null && <p>Recorded variant: <code>{variant}</code></p>}
    <fieldset disabled={!toggly || busy}>
      <legend>Explicit interactions for new-dashboard</legend>
      <button type="button" onClick={() => void run(async () => {
        const current = generation.current
        const owner = toggly!
        const result = await owner.isFeatureOn('new-dashboard')
        if (current === generation.current) setSelection({ owner, generation: current, enabled: result })
      }, 'Feature evaluated.')}>Evaluate telemetry feature</button>
      <button type="button" disabled={decision === null} onClick={() => void run(() => record('recordUsage'), 'Usage recorded.')}>Record usage</button>
      <button type="button" disabled={decision === null} onClick={() => void run(() => record('recordView'), 'View recorded.')}>Record view</button>
      <button type="button" onClick={() => void run(() => toggly!.incrementCounter('sample-actions', 1), 'Counter incremented.')}>Increment counter</button>
      <button type="button" onClick={() => void run(() => toggly!.setGauge('sample-cart-size', 3), 'Gauge set to 3.')}>Set gauge</button>
      <button type="button" onClick={() => void run(() => toggly!.flushTelemetry(), 'Flush attempted; delivery and aggregation are not guaranteed.')}>Flush telemetry</button>
    </fieldset>
    <p role="status">{status}</p>
    <p className="muted">Context and definition changes clear this selection; evaluate again before recording usage or view. This panel labels explicit events enabled/disabled; named experiment assignments remain in React surfaces. Evaluations across the showcase record checks automatically. Usage and view events occur only on their buttons, never from rendering this panel. Configure the sample-actions counter and sample-cart-size gauge in your sample application before expecting aggregated metrics.</p>
  </section>
}
