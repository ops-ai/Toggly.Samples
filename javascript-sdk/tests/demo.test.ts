import { describe, expect, it } from 'vitest'
import {
  createSnapshot,
  createTogglyConfig,
  matchingPreset,
  nonMatchingPreset,
  type FlagReader,
} from '../src/demo'

const reader = (values: Record<string, boolean>): FlagReader => ({
  isFeatureOn: (key) => values[key] ?? false,
  evaluateFeatureGate: (keys, requirement, negate) => {
    const enabled = requirement === 'any'
      ? keys.some((key) => values[key] ?? false)
      : keys.every((key) => values[key] ?? false)
    return negate ? !enabled : enabled
  },
  getVariant: () => null,
})

describe('createSnapshot', () => {
  it('uses gate requirement and negate semantics', () => {
    const snapshot = createSnapshot(reader({ 'new-dashboard': true, 'api-v2': false }))
    expect(snapshot.newDashboard).toBe(true)
    expect(snapshot.dashboardNegated).toBe(false)
    expect(snapshot.allGate).toBe(false)
    expect(snapshot.anyGate).toBe(true)
  })
})

describe('filter presets', () => {
  it('uses the shared matching values', () => {
    expect(matchingPreset).toMatchObject({ identity: 'alice', claims: { role: 'admin' }, country: 'US', vip: true })
    expect(matchingPreset.userAgent).toContain('Chrome/120')
  })

  it('uses the shared non-matching values', () => {
    expect(nonMatchingPreset).toMatchObject({ identity: 'bob', claims: { role: 'user' }, country: 'CA', vip: false })
    expect(nonMatchingPreset.userAgent).toContain('Firefox/121')
  })
})

describe('createTogglyConfig', () => {
  it('uses offline defaults without an app key or for the CI placeholder', () => {
    expect(createTogglyConfig('', { demo: true })).toEqual({
      flagDefaults: { demo: true }, enableLiveUpdates: false, persistCache: false,
    })
    expect(createTogglyConfig('ci-placeholder', { demo: true })).toEqual({
      flagDefaults: { demo: true }, enableLiveUpdates: false, persistCache: false,
    })
  })

  it('uses live evaluation for a real app key', () => {
    expect(createTogglyConfig('real-key', {}, 'Staging')).toEqual({
      appKey: 'real-key', environment: 'Staging', enableVariants: true,
    })
  })
})
