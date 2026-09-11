import type { TogglyClient } from '@ops-ai/nextjs-toggly-server'
import type { Order } from './orders'

// The mapper bridges app naming (vip/total) and Toggly rule naming (Vip/Total).
// kind selects the registered mapper; key identifies this entity, independently
// of the user identity. Register once, then pass each Order into each check.
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
