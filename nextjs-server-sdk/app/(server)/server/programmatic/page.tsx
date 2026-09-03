import {
  getServerToggly,
  isServerFeatureOn,
  useServerToggly,
} from '@ops-ai/nextjs-toggly-server'
import { hasTogglyAppKey } from '@/lib/env'
import { getRequestIdentity } from '@/lib/identity'
import { getOrder } from '@/lib/orders'

export default async function ServerProgrammaticPage() {
  if (!hasTogglyAppKey()) {
    return <p className="muted">Configure App Key for programmatic checks.</p>
  }

  const identity = await getRequestIdentity()
  // Server SDK helper (not a React hook) — named use* for RSC parity with docs.
  // eslint-disable-next-line react-hooks/rules-of-hooks -- @ops-ai/nextjs-toggly-server useServerToggly
  const viaHook = useServerToggly()
  const viaGet = getServerToggly()
  const vipOrder = getOrder('ord-vip')!

  // Client method: (key, context?, kind?, identityOverride?)
  const hookDashboard = await viaHook.isFeatureOn(
    'new-dashboard',
    null,
    undefined,
    identity,
  )
  const getDashboard = viaGet
    ? await viaGet.isFeatureOn('new-dashboard', null, undefined, identity)
    : false
  // Helper: identity string or { identity, context, contextKind }
  const helperDashboard = await isServerFeatureOn('new-dashboard', identity)
  const helperExpress = await isServerFeatureOn('ExpressCheckout', {
    identity,
    context: vipOrder,
    contextKind: 'Order',
  })
  const helperExpressNoEntity = await isServerFeatureOn('ExpressCheckout', {
    identity,
  })
  const hookExpress = await viaHook.isFeatureOn(
    'ExpressCheckout',
    vipOrder,
    'Order',
    identity,
  )

  return (
    <>
      <h1>Server programmatic API</h1>
      <p>
        <code>useServerToggly</code>, <code>getServerToggly</code>, and{' '}
        <code>isServerFeatureOn</code>. Identity for user flags:{' '}
        <code>{identity ?? '(none)'}</code>
      </p>

      <div className="card">
        <h2>new-dashboard</h2>
        <ul>
          <li>
            useServerToggly().isFeatureOn:{' '}
            <span className={hookDashboard ? 'on' : 'off'}>
              {hookDashboard ? 'ON' : 'OFF'}
            </span>
          </li>
          <li>
            getServerToggly().isFeatureOn:{' '}
            <span className={getDashboard ? 'on' : 'off'}>
              {getDashboard ? 'ON' : 'OFF'}
            </span>
          </li>
          <li>
            isServerFeatureOn:{' '}
            <span className={helperDashboard ? 'on' : 'off'}>
              {helperDashboard ? 'ON' : 'OFF'}
            </span>
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>ExpressCheckout (entity)</h2>
        <ul>
          <li>
            useServerToggly + Order entity (ord-vip):{' '}
            <span className={hookExpress ? 'on' : 'off'}>
              {hookExpress ? 'ON' : 'OFF'}
            </span>
          </li>
          <li>
            isServerFeatureOn + Order entity:{' '}
            <span className={helperExpress ? 'on' : 'off'}>
              {helperExpress ? 'ON' : 'OFF'}
            </span>
          </li>
          <li>
            No entity (fail closed):{' '}
            <span className={helperExpressNoEntity ? 'on' : 'off'}>
              {helperExpressNoEntity ? 'ON' : 'OFF'}
            </span>
          </li>
        </ul>
      </div>
    </>
  )
}
