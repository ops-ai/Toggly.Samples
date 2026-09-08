// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSample, type SampleSdk } from '../src/sample-app'

function sdk(overrides: Partial<SampleSdk> = {}): SampleSdk {
  const flags: Record<string, boolean> = { 'new-dashboard': true, 'api-v2': false, ExpressCheckout: true, 'filter-context-property': true }
  return {
    isFeatureOn: vi.fn((key: string) => flags[key] ?? false),
    evaluateFeatureGate: vi.fn((keys: string[], requirement = 0, negate = false) => {
      const value = requirement === 1 ? keys.some(k => flags[k]) : keys.every(k => flags[k])
      return negate ? !value : value
    }),
    getVariant: vi.fn(() => null), refresh: vi.fn(async () => flags),
    setContext: vi.fn(async () => flags), evaluationContext: { identity: 'alice', claims: { role: 'admin' } },
    ...overrides,
  }
}

describe('sample interactions', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>' })

  it('applies the identity input through the real DOM handler', async () => {
    const client = sdk()
    mountSample(document.querySelector('#app')!, client, { configured: false }).render()
    const input = document.querySelector<HTMLInputElement>('#identity-input')!
    input.value = 'carol'
    document.querySelector<HTMLButtonElement>('#apply-identity')!.click()
    await vi.waitFor(() => expect(client.setContext).toHaveBeenCalledWith({ identity: 'carol', claims: { role: 'admin' } }))
  })

  it('applies presets and evaluates Order-dependent flags with Order context', async () => {
    const client = sdk()
    mountSample(document.querySelector('#app')!, client, { configured: false }).render()
    document.querySelector<HTMLButtonElement>('#nonmatching')!.click()
    await vi.waitFor(() => expect(client.setContext).toHaveBeenCalledWith({ identity: 'bob', claims: { role: 'user' } }))
    expect(client.isFeatureOn).toHaveBeenCalledWith('filter-context-property', expect.objectContaining({ orderId: 'ord-standard', vip: false }), 'Order')
  })

  it('rerenders gates when the SDK refresh hook calls onRefresh', () => {
    let enabled = false
    const client = sdk({ isFeatureOn: vi.fn((key) => key === 'new-dashboard' && enabled) })
    const app = mountSample(document.querySelector('#app')!, client, { configured: true })
    app.render()
    expect(document.querySelector('[data-flag="new-dashboard"]')?.textContent).toBe('OFF')
    enabled = true
    app.onRefresh()
    expect(document.querySelector('[data-flag="new-dashboard"]')?.textContent).toBe('ON')
  })

  it('keeps fetch failures visible after rendering', async () => {
    const client = sdk({ refresh: vi.fn(async () => { throw new Error('network unavailable') }) })
    mountSample(document.querySelector('#app')!, client, { configured: true }).render()
    document.querySelector<HTMLButtonElement>('#refresh')!.click()
    await vi.waitFor(() => expect(document.querySelector('#evaluation-status')?.textContent).toContain('network unavailable'))
    expect(document.querySelector('#home')?.textContent).toContain('unavailable or cached')
  })

  it('renders hostile identity and variant strings as text, never markup', () => {
    const hostile = '<img src=x onerror=alert(1)>'
    const client = sdk({ evaluationContext: { identity: hostile, claims: { role: 'admin' } }, getVariant: vi.fn(() => ({ name: hostile })) })
    mountSample(document.querySelector('#app')!, client, { configured: true }).render()
    expect(document.querySelector<HTMLInputElement>('#identity-input')!.value).toBe(hostile)
    expect(document.querySelector('#variant-content')?.textContent).toContain(hostile)
    expect(document.querySelector('#variant-content img')).toBeNull()
  })

  it('renders named variant content and explicit fallback', () => {
    const root = document.querySelector('#app')!
    const client = sdk({ getVariant: vi.fn(() => ({ name: 'treatment-blue', configurationValue: { cta: 'Try blue' } })) })
    mountSample(root, client, { configured: true }).render()
    expect(document.querySelector('#variant-content')?.textContent).toContain('treatment-blue')
    ;(client.getVariant as ReturnType<typeof vi.fn>).mockReturnValue(null)
    mountSample(root, client, { configured: true }).render()
    expect(document.querySelector('#variant-content')?.textContent).toContain('No variant assigned')
  })
})
