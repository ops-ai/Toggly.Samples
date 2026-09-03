export type Order = {
  id: string
  vip: boolean
  total: number
  status: string
}

export const ORDERS: Order[] = [
  { id: 'ord-vip', vip: true, total: 40, status: 'open' },
  { id: 'ord-standard', vip: false, total: 40, status: 'open' },
  { id: 'ord-high-value', vip: false, total: 250, status: 'open' },
]

export function getOrder(id: string): Order | undefined {
  return ORDERS.find((o) => o.id === id)
}
