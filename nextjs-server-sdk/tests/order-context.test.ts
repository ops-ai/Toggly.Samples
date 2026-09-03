import { describe, it, expect, vi } from 'vitest'
import { ORDERS, getOrder } from '@/lib/orders'
import { registerOrderContext, mapOrderToContext } from '@/lib/order-context'

describe('orders fixtures', () => {
  it('includes vip and non-vip fixtures from the spec', () => {
    expect(getOrder('ord-vip')?.vip).toBe(true)
    expect(getOrder('ord-standard')?.vip).toBe(false)
    expect(getOrder('ord-high-value')?.total).toBe(250)
    expect(ORDERS).toHaveLength(3)
  })
})

describe('mapOrderToContext', () => {
  it('maps Vip and Total attributes with Order kind', () => {
    const order = getOrder('ord-vip')!
    expect(mapOrderToContext(order)).toEqual({
      kind: 'Order',
      key: 'ord-vip',
      attributes: { Vip: true, Total: 40 },
    })
  })
})

describe('registerOrderContext', () => {
  it('registers Order mapper on the client', () => {
    const registerContext = vi.fn()
    registerOrderContext({ registerContext } as never)
    expect(registerContext).toHaveBeenCalledWith('Order', expect.any(Function))
    const mapper = registerContext.mock.calls[0][1]
    expect(mapper(getOrder('ord-standard'))).toEqual({
      kind: 'Order',
      key: 'ord-standard',
      attributes: { Vip: false, Total: 40 },
    })
  })
})
