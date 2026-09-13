import { describe, expect, it } from 'vitest'
import {
  evaluateFeatureGate,
  isFeatureOff,
  isFeatureOn,
} from '@ops-ai/electron-feature-flags-toggly/renderer'

describe('published Electron renderer entry', () => {
  it('fails closed when it runs outside the preload bridge', () => {
    // This imports the installed npm artifact, not the SDK source checkout. It
    // proves the documented renderer entry resolves for an offline test process.
    expect(isFeatureOn('new-dashboard')).toBe(false)
    expect(isFeatureOff('new-dashboard')).toBe(true)
    expect(evaluateFeatureGate(['new-dashboard'], 'all', true)).toBe(true)
  })
})
