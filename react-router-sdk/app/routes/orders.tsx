import { Link, useLoaderData, type LoaderFunctionArgs } from 'react-router'
import { ORDERS } from '../lib/sample-data'
import { hasServerKey, requestContext, sampleLoader } from '../lib/toggly.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const id = new URL(request.url).searchParams.get('id') || 'ord-vip'
  const order = ORDERS.find((entry) => entry.id === id) || ORDERS[0]
  if (!hasServerKey()) return { order, enabled: false, configured: false }
  const client = sampleLoader().getClient()
  client.registerContext('Order', (value: typeof order) => ({
    kind: 'Order',
    key: value.id,
    attributes: { Vip: value.vip, Total: value.total },
  }))
  await client.init()
  // Installed server client: isEnabled(featureKey, context?, defaultValue?, entity?, kind?)
  return {
    order,
    enabled: await client.isEnabled('ExpressCheckout', requestContext(request), false, order, 'Order'),
    configured: true,
  }
}

export default function Orders() {
  const page = useLoaderData<typeof loader>()
  return (
    <>
      <h1>Order VIP context</h1>
      <p>
        <code>ExpressCheckout</code> must be configured with ContextProperty <code>Order.Vip=true</code>.
        Mapping happens once; each evaluation passes its own Order entity.
      </p>
      {ORDERS.map((order) => (
        <p key={order.id}>
          <Link to={`?id=${order.id}`}>{order.id}</Link> — Vip={String(order.vip)}, total={order.total}
        </p>
      ))}
      <pre>{JSON.stringify(page, null, 2)}</pre>
      <p>Without an Order or with the wrong context kind, an entity gate fails closed. A high order total does not imply VIP.</p>
    </>
  )
}
