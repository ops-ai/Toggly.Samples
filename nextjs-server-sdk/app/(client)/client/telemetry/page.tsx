import { TelemetryDemo } from '@/components/telemetry-demo'

export default function TelemetryPage() {
  const hasKey = Boolean(process.env.NEXT_PUBLIC_TOGGLY_APP_KEY?.trim())
  return (
    <>
      <h1>Browser telemetry</h1>
      <p>Use the existing browser provider to record feature interactions and app metrics. Server and edge evaluation keep their separate ownership.</p>
      <p>Configure <code>sample-interactions</code> as a counter and <code>sample-cart-value</code> as a gauge in your sample application before checking aggregated metrics. This demo reports boolean enabled/disabled results, not experiment assignments.</p>
      {hasKey ? <TelemetryDemo /> : <p>Telemetry controls require a public app key.</p>}
    </>
  )
}
