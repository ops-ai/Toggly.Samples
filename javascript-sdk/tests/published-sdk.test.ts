// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import '@ops-ai/feature-flags-toggly'

describe('published SDK integration', () => {
  const Toggly = window.Toggly

  beforeAll(async () => {
    localStorage.clear()
    Toggly.registerContext<{ orderId: string; vip: boolean }>('Order', order => ({
      kind: 'Order', key: order.orderId, attributes: { Vip: order.vip },
    }))
    await Toggly.init({
      flagDefaults: { 'new-dashboard': true, 'api-v2': false },
      enableLiveUpdates: false, persistCache: false,
    })
  })

  afterAll(() => Toggly.cancelRefreshInterval())

  it('evaluates feature, negate, all, and any gates using the actual artifact', () => {
    expect(Toggly.isFeatureOn('new-dashboard')).toBe(true)
    expect(Toggly.evaluateFeatureGate(['new-dashboard'], 0, true)).toBe(false)
    expect(Toggly.evaluateFeatureGate(['new-dashboard', 'api-v2'], 0)).toBe(false)
    expect(Toggly.evaluateFeatureGate(['new-dashboard', 'api-v2'], 1)).toBe(true)
  })

  it('evaluates the actual entity gate with a registered Order', () => {
    Toggly.cacheFeatureFlags({
      'filter-context-property': { requirement: 'all', rules: [{ property: 'Vip', op: 'eq', value: 'true' }] },
    })
    expect(Toggly.isFeatureOn('filter-context-property', { orderId: 'ord-vip', vip: true }, 'Order')).toBe(true)
    expect(Toggly.isFeatureOn('filter-context-property', { orderId: 'ord-standard', vip: false }, 'Order')).toBe(false)
  })

  it('invokes a supported afterRefresh hook from the actual artifact', async () => {
    const afterRefresh = vi.fn(async () => undefined)
    await Toggly.init({ flagDefaults: { demo: true }, enableLiveUpdates: false, persistCache: false, hooks: [{ getMetadata: () => ({ name: 'test-refresh', version: '1' }), afterRefresh }] })
    afterRefresh.mockClear()
    await Toggly.refresh()
    expect(afterRefresh).toHaveBeenCalledOnce()
  })

  it('returns named variant data and no-variant fallback from the actual artifact', async () => {
    await Toggly.init({ flagDefaults: {}, enableLiveUpdates: false, persistCache: true, enableVariants: true })
    Toggly.cacheFeatureFlags({ 'new-dashboard': true })
    Toggly.cacheVariants({ 'new-dashboard': { enabled: true, variant: 'treatment-blue', configurationValue: { cta: 'Try blue' } } })
    expect(Toggly.getVariant('new-dashboard')).toEqual({ name: 'treatment-blue', configurationValue: { cta: 'Try blue' } })
    expect(Toggly.getVariant('api-v2')).toBeNull()
  })
})
