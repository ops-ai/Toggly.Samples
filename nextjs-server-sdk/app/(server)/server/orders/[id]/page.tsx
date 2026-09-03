import { notFound } from 'next/navigation'
import { getServerToggly } from '@ops-ai/nextjs-toggly-server'
import { getOrder } from '@/lib/orders'
import { hasTogglyAppKey } from '@/lib/env'
import { getRequestIdentity } from '@/lib/identity'

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const order = getOrder(id)
  if (!order) notFound()
  if (!hasTogglyAppKey()) {
    return <p>Configure App Key.</p>
  }

  const identity = await getRequestIdentity()
  const toggly = getServerToggly()
  if (!toggly) {
    return <p className="off">Toggly client not initialized.</p>
  }
  const withEntity = await toggly.isFeatureOn(
    'ExpressCheckout',
    order,
    'Order',
    identity,
  )
  const noEntity = await toggly.isFeatureOn(
    'ExpressCheckout',
    null,
    undefined,
    identity,
  )
  const unknownKind = await toggly.isFeatureOn(
    'ExpressCheckout',
    order,
    'Unknown',
    identity,
  )

  return (
    <>
      <h1>Order {order.id}</h1>
      <pre>{JSON.stringify(order, null, 2)}</pre>
      <ul>
        <li>
          With Order entity:{' '}
          <span className={withEntity ? 'on' : 'off'}>
            {withEntity ? 'ON' : 'OFF'}
          </span>
        </li>
        <li>
          No entity (fail closed):{' '}
          <span className={noEntity ? 'on' : 'off'}>
            {noEntity ? 'ON' : 'OFF'}
          </span>
        </li>
        <li>
          Kind &apos;Unknown&apos; (fail closed):{' '}
          <span className={unknownKind ? 'on' : 'off'}>
            {unknownKind ? 'ON' : 'OFF'}
          </span>
        </li>
      </ul>
    </>
  )
}
