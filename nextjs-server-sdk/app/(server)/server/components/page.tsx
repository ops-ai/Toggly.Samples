import {
  Feature,
  FeatureVariant,
} from '@ops-ai/nextjs-toggly-server'
import { hasTogglyAppKey } from '@/lib/env'
import { getRequestIdentity } from '@/lib/identity'
import { getOrder } from '@/lib/orders'

// Feature renders children only when its boolean gate succeeds; negate renders
// the opposite. With multiple keys, all/any is applied before negate, so "not
// both ON" also includes one-on/one-off. FeatureVariant selects enabled/disabled
// markup; its name does not imply experiment assignment or analytics.
export default async function ServerComponentsPage() {
  if (!hasTogglyAppKey()) {
    return <p className="muted">Configure App Key to evaluate components.</p>
  }

  const identity = await getRequestIdentity()
  const vipOrder = getOrder('ord-vip')!

  return (
    <>
      <h1>Server components</h1>
      <p>
        <code>Feature</code>, <code>negate</code>, <code>FeatureVariant</code>,
        multi-key <code>requirement</code>, and entity props. Optional identity:{' '}
        <code>{identity ?? '(none)'}</code>
      </p>

      <div className="card">
        <h2>Feature (on)</h2>
        <Feature featureKey="new-dashboard" identity={identity}>
          <p className="on">new-dashboard is ON</p>
        </Feature>
      </div>

      <div className="card">
        <h2>Feature negate (off)</h2>
        <Feature featureKey="new-dashboard" negate identity={identity}>
          <p className="on">Shown when new-dashboard is OFF</p>
        </Feature>
      </div>

      <div className="card">
        <h2>FeatureVariant</h2>
        <FeatureVariant
          featureKey="new-dashboard"
          identity={identity}
          enabled={<p className="on">Variant: enabled branch</p>}
          disabled={<p className="off">Variant: disabled branch</p>}
        />
      </div>

      <div className="card">
        <h2>Multi-key requirement=&quot;all&quot;</h2>
        <Feature
          featureKey={['new-dashboard', 'api-v2']}
          requirement="all"
          identity={identity}
        >
          <p className="on">Both new-dashboard and api-v2 are ON</p>
        </Feature>
        <Feature
          featureKey={['new-dashboard', 'api-v2']}
          requirement="all"
          negate
          identity={identity}
        >
          <p className="off">Not both ON</p>
        </Feature>
      </div>

      <div className="card">
        <h2>Multi-key requirement=&quot;any&quot;</h2>
        <Feature
          featureKey={['new-dashboard', 'api-v2']}
          requirement="any"
          identity={identity}
        >
          <p className="on">At least one of new-dashboard / api-v2 is ON</p>
        </Feature>
      </div>

      <div className="card">
        <h2>Entity context (ExpressCheckout + Order)</h2>
        <Feature
          featureKey="ExpressCheckout"
          identity={identity}
          context={vipOrder}
          contextKind="Order"
        >
          <p className="on">ExpressCheckout ON for ord-vip</p>
        </Feature>
        <Feature
          featureKey="ExpressCheckout"
          identity={identity}
          context={vipOrder}
          contextKind="Order"
          negate
        >
          <p className="off">ExpressCheckout OFF for ord-vip</p>
        </Feature>
      </div>
    </>
  )
}
