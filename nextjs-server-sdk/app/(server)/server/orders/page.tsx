import Link from 'next/link'
import { getServerToggly } from '@ops-ai/nextjs-toggly-server'
import { ORDERS } from '@/lib/orders'
import { hasTogglyAppKey } from '@/lib/env'
import { getRequestIdentity } from '@/lib/identity'

export default async function OrdersPage() {
  if (!hasTogglyAppKey()) {
    return <p>Configure App Key to evaluate ExpressCheckout.</p>
  }

  const identity = await getRequestIdentity()
  const toggly = getServerToggly()
  if (!toggly) {
    return <p className="off">Toggly client not initialized.</p>
  }

  const rows = await Promise.all(
    ORDERS.map(async (order) => {
      const on = await toggly.isFeatureOn(
        'ExpressCheckout',
        order,
        'Order',
        identity,
      )
      return { order, on }
    }),
  )

  return (
    <>
      <h1>Orders</h1>
      <p>
        <code>ExpressCheckout</code> with entity context kind <code>Order</code>{' '}
        (Vip==true).
      </p>
      <ul>
        {rows.map(({ order, on }) => (
          <li key={order.id}>
            <Link href={`/server/orders/${order.id}`}>{order.id}</Link>
            {' — '}
            vip={String(order.vip)}, total={order.total}{' '}
            <span className={on ? 'on' : 'off'}>
              {on ? 'ExpressCheckout ON' : 'OFF'}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
