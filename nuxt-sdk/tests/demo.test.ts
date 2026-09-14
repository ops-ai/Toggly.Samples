import { describe, expect, it } from 'vitest'
import { allFlagKeys, filterFlags, isDemoPreset, orderForPreset } from '../lib/demo'

describe('shared catalogue inputs', () => {
  it('keeps the exact eleven filter rows in the sample contract', () => {
    expect(filterFlags).toHaveLength(11)
    expect(allFlagKeys).toContain('filter-context-property')
    expect(allFlagKeys).toContain('ExpressCheckout')
  })

  it('maps matching and non-matching presets to distinct Order entities', () => {
    expect(orderForPreset('matching')).toEqual({
      kind: 'Order',
      key: 'ord-vip',
      attributes: { Vip: true, Total: 250 },
    })
    expect(orderForPreset('non-matching').attributes.Vip).toBe(false)
  })

  it('accepts only the two documented presets', () => {
    expect(isDemoPreset('matching')).toBe(true)
    expect(isDemoPreset('non-matching')).toBe(true)
    expect(isDemoPreset('custom')).toBe(false)
  })
})
