import { describe, expect, it } from 'vitest'
import { normalizeEntityContext } from '@ops-ai/toggly-hooks-types'
import { buildOrderContext, filterPreset, filterResult, missingKeyMessage } from '../src/renderer/demo-model'

describe('Electron sample teaching model', () => {
  it('maps the VIP Order example to the SDK entity shape', () => {
    expect(buildOrderContext(true)).toEqual({
      kind: 'Order',
      key: 'ord-vip',
      attributes: { Id: 'ord-vip', Vip: true, Total: 199 },
    })
    expect(buildOrderContext(false)).toEqual({
      kind: 'Order',
      key: 'ord-standard',
      attributes: { Id: 'ord-standard', Vip: false, Total: 49 },
    })
    expect(normalizeEntityContext(buildOrderContext(true), 'Order')).toEqual(buildOrderContext(true))
  })

  it('keeps matching and non-matching filter inputs explicit', () => {
    expect(filterPreset('matching')).toMatchObject({ identity: 'alice', country: 'US', role: 'admin' })
    expect(filterPreset('non-matching')).toMatchObject({ identity: 'bob', country: 'CA', role: 'user' })
  })

  it('explains placeholder and absent app keys without treating them as live configuration', () => {
    expect(missingKeyMessage('')).toContain('no network')
    expect(missingKeyMessage('ci-placeholder')).toContain('placeholder')
    expect(missingKeyMessage('real-app-key')).toBeNull()
  })

  it('uses the selected Order evaluation for the context-property matrix row', () => {
    const snapshot = { 'filter-context-property': false, 'filter-targeting': true }

    expect(filterResult('filter-context-property', snapshot, true)).toBe(true)
    expect(filterResult('filter-targeting', snapshot, false)).toBe(true)
  })
})
