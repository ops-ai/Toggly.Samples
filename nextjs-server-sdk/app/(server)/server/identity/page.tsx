import { Feature, isServerFeatureOn } from '@ops-ai/nextjs-toggly-server'
import { hasTogglyAppKey } from '@/lib/env'
import { getRequestIdentity } from '@/lib/identity'
import { IdentitySwitcher } from '@/components/identity-switcher'

export default async function ServerIdentityPage() {
  if (!hasTogglyAppKey()) {
    return <p className="muted">Configure App Key for identity demos.</p>
  }

  const identity = await getRequestIdentity()

  // Compare the explicit cookie override with the SDK's process defaults.
  // A global boolean matches for both; targeting/percentage rules make identity
  // relevant. "Without" means no override, not necessarily an empty SDK identity.
  const withIdentity = await isServerFeatureOn('new-dashboard', identity)
  const withoutIdentity = await isServerFeatureOn('new-dashboard')

  return (
    <>
      <h1>Per-call identity</h1>
      <p>
        Cookie <code>toggly-identity</code> is read via{' '}
        <code>getRequestIdentity()</code> and passed into helpers /{' '}
        <code>Feature</code>. The process-wide client is never mutated.
      </p>

      <IdentitySwitcher current={identity} />

      <div className="card">
        <h2>Side-by-side (new-dashboard)</h2>
        <ul>
          <li>
            With cookie identity (<code>{identity ?? '(none)'}</code>):{' '}
            <span className={withIdentity ? 'on' : 'off'}>
              {withIdentity ? 'ON' : 'OFF'}
            </span>
          </li>
          <li>
            Without identity argument:{' '}
            <span className={withoutIdentity ? 'on' : 'off'}>
              {withoutIdentity ? 'ON' : 'OFF'}
            </span>
          </li>
        </ul>
        <p className="muted">
          For a boolean flag without percentage targeting, both sides usually
          match. Use this page to confirm the cookie is threaded into checks.
        </p>
      </div>

      <div className="card">
        <h2>Feature with identity prop</h2>
        <Feature featureKey="new-dashboard" identity={identity}>
          <p className="on">Feature children with per-call identity</p>
        </Feature>
        <Feature featureKey="new-dashboard" negate identity={identity}>
          <p className="off">Negate children with per-call identity</p>
        </Feature>
      </div>
    </>
  )
}
