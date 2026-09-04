import Link from 'next/link'

export default function ServerIndexPage() {
  return (
    <>
      <h1>Server showcase</h1>
      <p>
        Demos for <code>@ops-ai/nextjs-toggly-server</code>. Evaluation runs in
        the Node process (RSC / Server Actions / Route Handlers). Pass identity
        per check — do not mutate the shared client.
      </p>
      <ul>
        <li>
          <Link href="/server/components">Components</Link> — Feature, negate,
          FeatureVariant, multi-key, entity
        </li>
        <li>
          <Link href="/server/programmatic">Programmatic</Link> — useServerToggly,
          getServerToggly, isServerFeatureOn
        </li>
        <li>
          <Link href="/server/actions">Actions</Link> — checkFeature,
          checkFeatureGate, withFeature
        </li>
        <li>
          <Link href="/server/cache">Cache</Link> — cachedIsFeatureOn,
          cachedEvaluateFeatureGate
        </li>
        <li>
          <Link href="/server/identity">Identity</Link> — per-call cookie
          identity
        </li>
        <li>
          <Link href="/server/dashboard">Dashboard</Link> — new-dashboard
          Feature / negate
        </li>
        <li>
          <Link href="/server/api-demo">API demo</Link> —{' '}
          <Link href="/api/data">GET /api/data</Link> (api-v2)
        </li>
        <li>
          <Link href="/server/orders">Orders</Link> — ExpressCheckout entity
          context
        </li>
        <li>
          <Link href="/server/filters">Filters</Link> — every supported filter
          type with controllable eval context
        </li>
      </ul>
    </>
  )
}
