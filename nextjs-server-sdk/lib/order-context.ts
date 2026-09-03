import type { TogglyClient } from '@ops-ai/nextjs-toggly-server'
import type { Order } from './orders'

export function mapOrderToContext(order: Order) {
  return {
    kind: 'Order' as const,
    key: order.id,
    attributes: { Vip: order.vip, Total: order.total },
  }
}

export function registerOrderContext(
  client: Pick<TogglyClient, 'registerContext'>,
): void {
  client.registerContext<Order>('Order', mapOrderToContext)
}
