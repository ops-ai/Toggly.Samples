import {
  cachedEvaluateFeatureGate,
  cachedIsFeatureOn,
} from '@ops-ai/nextjs-toggly-server'
import { hasTogglyAppKey } from '@/lib/env'
import { getRequestIdentity } from '@/lib/identity'
import { getOrder } from '@/lib/orders'

export default async function ServerCachePage() {
  if (!hasTogglyAppKey()) {
    return <p className="muted">Configure App Key for cached helpers.</p>
  }

  const identity = await getRequestIdentity()
  const vipOrder = getOrder('ord-vip')!

  const cachedDashboard = await cachedIsFeatureOn('new-dashboard', {
    identity,
    revalidate: 60,
    tags: ['feature-flags', 'new-dashboard'],
  })

  const cachedGate = await cachedEvaluateFeatureGate(
    ['new-dashboard', 'api-v2'],
    {
      requirement: 'all',
      identity,
      revalidate: 60,
      tags: ['feature-flags'],
    },
  )

  const cachedExpress = await cachedIsFeatureOn('ExpressCheckout', {
    identity,
    context: vipOrder,
    contextKind: 'Order',
    revalidate: 60,
    tags: ['feature-flags', 'ExpressCheckout'],
  })

  return (
    <>
      <h1>Server cache helpers</h1>
      <p className="banner" role="note">
        These values use Next.js <code>unstable_cache</code> (
        <code>revalidate: 60</code>). They may lag live WebSocket updates until
        revalidation — labeled clearly as cached.
      </p>

      <div className="card">
        <h2>cachedIsFeatureOn(&apos;new-dashboard&apos;)</h2>
        <p className={cachedDashboard ? 'on' : 'off'}>
          {cachedDashboard ? 'ON (cached)' : 'OFF (cached)'}
        </p>
      </div>

      <div className="card">
        <h2>
          cachedEvaluateFeatureGate([new-dashboard, api-v2], all)
        </h2>
        <p className={cachedGate ? 'on' : 'off'}>
          {cachedGate ? 'ALLOWED (cached)' : 'DENIED (cached)'}
        </p>
      </div>

      <div className="card">
        <h2>cachedIsFeatureOn(ExpressCheckout + Order)</h2>
        <p className={cachedExpress ? 'on' : 'off'}>
          {cachedExpress ? 'ON (cached)' : 'OFF (cached)'}
        </p>
      </div>
    </>
  )
}
