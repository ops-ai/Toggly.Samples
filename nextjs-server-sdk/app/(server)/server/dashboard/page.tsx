import { Feature, getServerToggly } from '@ops-ai/nextjs-toggly-server'
import { hasTogglyAppKey } from '@/lib/env'
import { getRequestIdentity } from '@/lib/identity'

export default async function DashboardPage() {
  if (!hasTogglyAppKey()) {
    return (
      <p className="muted">Configure App Key to evaluate new-dashboard.</p>
    )
  }

  const identity = await getRequestIdentity()
  const toggly = getServerToggly()
  if (!toggly) {
    return <p className="off">Toggly client not initialized.</p>
  }
  // The method and JSX gates use the same flag key and request identity.
  // new-dashboard is the exact dashboard key, not its human-readable title.
  // Server rendering chooses markup now; refresh the route to render new results.
  const programmatic = await toggly.isFeatureOn(
    'new-dashboard',
    null,
    undefined,
    identity,
  )

  return (
    <>
      <h1>Dashboard</h1>
      <p>
        Programmatic{' '}
        <code>getServerToggly().isFeatureOn(&apos;new-dashboard&apos;)</code>:{' '}
        <span className={programmatic ? 'on' : 'off'}>
          {programmatic ? 'ON' : 'OFF'}
        </span>
      </p>

      <div className="card">
        <h2>Feature component</h2>
        <Feature featureKey="new-dashboard" identity={identity}>
          <p className="on">New dashboard UI (flag on)</p>
        </Feature>
      </div>

      <div className="card">
        <h2>Feature negate</h2>
        <Feature featureKey="new-dashboard" negate identity={identity}>
          <p className="on">Shown when new-dashboard is OFF</p>
        </Feature>
      </div>
    </>
  )
}
