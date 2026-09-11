export type Order = {
  id: string
  vip: boolean
  total: number
  status: string
}

// Fixed domain fixtures keep the experiment repeatable; these are not SDK
// definitions. The high-value non-VIP order proves Total alone does not satisfy
// the configured ExpressCheckout rule (Order.Vip == true).
export const ORDERS: Order[] = [
  { id: 'ord-vip', vip: true, total: 40, status: 'open' },
  { id: 'ord-standard', vip: false, total: 40, status: 'open' },
  { id: 'ord-high-value', vip: false, total: 250, status: 'open' },
]

export function getOrder(id: string): Order | undefined {
  return ORDERS.find((o) => o.id === id)
}
