import { describe, expect, it } from 'vitest'
import { allFlagKeys, filterFlags, isDemoPreset, orderForPreset } from '../lib/demo'
import { EventEmitter } from 'node:events'
import { createEvent } from 'h3'
import { createTogglyModuleOptions } from '../lib/toggly-options'
import { getDemoEvalContext } from '../server/utils/demo-context'

function requestEvent(url: string, cookie?: string) {
  const request = Object.assign(new EventEmitter(), {
    method: 'GET',
    url,
    headers: cookie ? { cookie } : {},
  })
  const response = Object.assign(new EventEmitter(), {
    statusCode: 200,
    getHeader: () => undefined,
    setHeader: () => undefined,
    end: () => undefined,
  })
  return createEvent(request as never, response as never)
}

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

  it('forwards the Nuxt-loaded application key to the module options', () => {
    expect(
      createTogglyModuleOptions({
        TOGGLY_APP_KEY: 'loaded-from-dotenv',
        TOGGLY_ENVIRONMENT: 'Preview',
      }),
    ).toMatchObject({
      appKey: 'loaded-from-dotenv',
      environment: 'Preview',
    })
  })

  it('uses a changed browser-session cookie for both request presets', () => {
    const cookie = 'demo-identity=carol'
    expect(getDemoEvalContext(requestEvent('/?preset=matching', cookie)).identity).toBe('carol')
    expect(getDemoEvalContext(requestEvent('/?preset=non-matching', cookie)).identity).toBe('carol')
  })

  it('keeps each preset identity when no browser session cookie exists', () => {
    expect(getDemoEvalContext(requestEvent('/?preset=matching')).identity).toBe('alice')
    expect(getDemoEvalContext(requestEvent('/?preset=non-matching')).identity).toBe('bob')
  })
})


describe('browser telemetry configuration stays separate from server metrics', () => {
  it('enables the browser owner only with a key and preserves server opt-outs', () => {
    expect(createTogglyModuleOptions({ TOGGLY_APP_KEY: 'test-only' })).toMatchObject({
      enableTelemetry: true, enableUsageTracking: true, enableMetrics: true,
      serverEnableUsageTracking: false, serverEnableMetrics: false,
    })
    expect(createTogglyModuleOptions({})).toMatchObject({ enableTelemetry: false })
  })
  it('forwards opt-out and explicit definition/metrics endpoints through module options', () => {
    expect(createTogglyModuleOptions({
      TOGGLY_APP_KEY: 'test-only', TOGGLY_ENABLE_TELEMETRY: 'false',
      TOGGLY_BASE_URI: 'http://127.0.0.1:4199', TOGGLY_METRICS_BASE_URL: 'https://metrics.test.invalid',
    })).toMatchObject({ enableTelemetry: false, baseUri: 'http://127.0.0.1:4199', metricsBaseUrl: 'https://metrics.test.invalid' })
  })
  it('can disable live updates during an isolated public-consumer probe', () => {
    expect(createTogglyModuleOptions({ TOGGLY_ENABLE_LIVE_UPDATES: 'false' }))
      .toMatchObject({ enableLiveUpdates: false })
  })
})
