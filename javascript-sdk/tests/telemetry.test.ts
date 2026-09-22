// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@ops-ai/feature-flags-toggly'
import { createTogglyConfig } from '../src/demo'
import { mountSample, type SampleSdk } from '../src/sample-app'

type CapturedRequest = { url: string; init?: RequestInit }
const requests: CapturedRequest[] = []
const Toggly = window.Toggly

function telemetryRequests() {
  return requests.filter(request => request.url.endsWith('/api/frontend/telemetry'))
}

async function telemetryBodies() {
  return Promise.all(telemetryRequests().map(async request => {
    const body = request.init?.body
    if (typeof body === 'string') return JSON.parse(body)
    const stream = new Blob([body as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
    return JSON.parse(await new Response(stream).text())
  }))
}

beforeEach(() => {
  localStorage.clear()
  Toggly.cancelRefreshInterval()
  Toggly.setLocalGates([])
  requests.length = 0
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    requests.push({ url, init })
    if (url.endsWith('/api/frontend/telemetry')) return { status: 202, ok: true } as Response
    const defs = url.includes('/evaluated-variants-signed')
      ? { 'new-dashboard': { enabled: true, variant: 'treatment-blue' } }
      : { 'new-dashboard': true }
    return {
      status: 200,
      ok: true,
      json: async () => ({ defs }),
      text: async () => JSON.stringify({ defs }),
    } as Response
  }))
})

afterEach(() => {
  Toggly.cancelRefreshInterval()
  Toggly.stopWebSocket()
  vi.unstubAllGlobals()
})

describe('published browser telemetry', () => {
  it('captures an automatic check, explicit usage and view events, metrics, and flush', async () => {
    await Toggly.init({
      appKey: 'sample-test-key',
      environment: 'Production',
      identity: 'sample-test-user',
      enableLiveUpdates: false,
      featureFlagsRefreshInterval: 0,
      persistCache: false,
      verifySignatures: false,
      enableVariants: true,
      metricsBaseUrl: 'https://telemetry.test.invalid',
      telemetryFlushIntervalMs: 60_000,
    })
    Toggly.cacheVariants({
      'new-dashboard': { enabled: true, variant: 'treatment-blue', configurationValue: { cta: 'Try it' } },
    })

    expect(Toggly.isFeatureOn('new-dashboard')).toBe(true)
    const variant = Toggly.getVariant('new-dashboard')
    expect(variant?.name).toBe('treatment-blue')
    Toggly.recordUsage('new-dashboard', variant?.name ?? 'enabled')
    Toggly.recordView('new-dashboard', variant?.name ?? 'enabled')
    Toggly.incrementCounter('sample-actions', 1)
    Toggly.setGauge('sample-cart-size', 3)
    await Toggly.flushTelemetry()

    const request = telemetryRequests()[0]
    expect(request?.url).toBe('https://telemetry.test.invalid/api/frontend/telemetry')
    expect(request?.init?.method).toBe('POST')
    const bodies = await telemetryBodies()
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toEqual({
      k: 'sample-test-key',
      e: 'Production',
      u: 'sample-test-user',
      f: {
        'new-dashboard': {
          'treatment-blue': [2, 1, 1],
        },
      },
      m: { 'sample-actions': 1, 'sample-cart-size': 3 },
    })
  })

  it.each([
    ['missing app key', { flagDefaults: { 'new-dashboard': true }, enableTelemetry: false }],
    ['telemetry opt-out', { appKey: 'sample-test-key', enableTelemetry: false, flagDefaults: { 'new-dashboard': true } }],
  ])('%s keeps feature evaluation available without a telemetry POST', async (_label, options) => {
    await Toggly.init({
      environment: 'Production',
      enableLiveUpdates: false,
      featureFlagsRefreshInterval: 0,
      persistCache: false,
      verifySignatures: false,
      ...options,
    })

    expect(Toggly.isFeatureOn('new-dashboard')).toBe(true)
    Toggly.recordUsage('new-dashboard')
    Toggly.recordView('new-dashboard')
    Toggly.incrementCounter('sample-actions', 1)
    Toggly.setGauge('sample-cart-size', 3)
    await Toggly.flushTelemetry()

    expect(telemetryRequests()).toHaveLength(0)
  })
})

describe('telemetry sample controls', () => {
  it('evaluates the selected flag and records explicit events only when their controls are used', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    const client = {
      isFeatureOn: vi.fn(() => true),
      evaluateFeatureGate: vi.fn(() => true),
      getVariant: vi.fn(() => ({ name: 'treatment-blue', configurationValue: { cta: 'Try blue' } })),
      refresh: vi.fn(async () => ({})),
      setContext: vi.fn(async () => ({})),
      evaluationContext: { identity: 'alice', claims: { role: 'admin' } },
      recordUsage: vi.fn(),
      recordView: vi.fn(),
      incrementCounter: vi.fn(),
      setGauge: vi.fn(),
      flushTelemetry: vi.fn(async () => undefined),
    } as unknown as SampleSdk
    const app = mountSample(document.querySelector('#app')!, client, { configured: true, telemetryEnabled: true })
    app.render()

    expect(client.recordView).not.toHaveBeenCalled()
    document.querySelector<HTMLButtonElement>('#telemetry-evaluate')!.click()
    document.querySelector<HTMLButtonElement>('#telemetry-usage')!.click()
    document.querySelector<HTMLButtonElement>('#telemetry-view')!.click()
    document.querySelector<HTMLButtonElement>('#telemetry-counter')!.click()
    document.querySelector<HTMLButtonElement>('#telemetry-gauge')!.click()
    document.querySelector<HTMLButtonElement>('#telemetry-flush')!.click()

    expect(client.isFeatureOn).toHaveBeenCalledWith('new-dashboard')
    expect(client.getVariant).toHaveBeenCalledWith('new-dashboard')
    expect(client.recordUsage).toHaveBeenCalledWith('new-dashboard', 'treatment-blue')
    expect(client.recordView).toHaveBeenCalledWith('new-dashboard', 'treatment-blue')
    expect(client.incrementCounter).toHaveBeenCalledWith('sample-actions', 1)
    expect(client.setGauge).toHaveBeenCalledWith('sample-cart-size', 3)
    await vi.waitFor(() => expect(client.flushTelemetry).toHaveBeenCalledOnce())
    expect(document.querySelector('#telemetry-check-result')?.textContent).toContain('treatment-blue')
  })

  it('keeps offline and opted-out telemetry controls silent while evaluation stays available', () => {
    document.body.innerHTML = '<div id="app"></div>'
    const client = {
      isFeatureOn: vi.fn(() => true),
      evaluateFeatureGate: vi.fn(() => true),
      getVariant: vi.fn(() => null),
      refresh: vi.fn(async () => ({})),
      setContext: vi.fn(async () => ({})),
      evaluationContext: {},
      recordUsage: vi.fn(), recordView: vi.fn(), incrementCounter: vi.fn(), setGauge: vi.fn(),
      flushTelemetry: vi.fn(async () => undefined),
    } as unknown as SampleSdk
    const app = mountSample(document.querySelector('#app')!, client, { configured: true, telemetryEnabled: false })
    app.render()

    expect(document.querySelector<HTMLButtonElement>('#telemetry-evaluate')?.disabled).toBe(false)
    expect(document.querySelector<HTMLButtonElement>('#telemetry-usage')?.disabled).toBe(true)
    expect(document.querySelector('#telemetry-status')?.textContent).toContain('opted out')
    expect(createTogglyConfig('sample-key', {}, 'Production', false)).toMatchObject({ enableTelemetry: false })
    expect(createTogglyConfig('', { 'new-dashboard': true })).toMatchObject({ enableTelemetry: false, enableLiveUpdates: false })
  })
})
