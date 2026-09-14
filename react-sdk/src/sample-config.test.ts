import { describe, expect, it } from 'vitest'
import {
  createProviderOptions,
  createSessionIdentity,
  mapOrderContext,
} from './sample-config'

describe('sample configuration', () => {
  it('fails closed with local defaults when an app key is absent', () => {
    expect(createProviderOptions('', 'Production', 'session-alice')).toEqual(
      expect.objectContaining({
        identity: 'session-alice',
        environment: 'Production',
        enableLiveUpdates: false,
        persistCache: false,
        featureDefaults: expect.objectContaining({
          'new-dashboard': false,
          ExpressCheckout: false,
        }),
      }),
    )
    expect(createProviderOptions('', 'Production', 'session-alice')).not.toHaveProperty(
      'appKey',
    )
  })

  it('uses the supplied app key and keeps offline defaults as a safe fallback', () => {
    expect(createProviderOptions('sample-key', 'Production', 'session-alice')).toEqual(
      expect.objectContaining({
        appKey: 'sample-key',
        identity: 'session-alice',
        enableVariants: true,
        featureDefaults: expect.objectContaining({ 'api-v2': false }),
      }),
    )
  })

  it('keeps an existing session identity and creates a new one only when needed', () => {
    const stored = new Map<string, string>([
      ['toggly-react-sample.identity', 'alice'],
    ])
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    }

    expect(createSessionIdentity(storage)).toBe('alice')

    const created = createSessionIdentity({
      getItem: () => null,
      setItem: () => undefined,
    })
    expect(created).toMatch(/^sample-/)
  })

  it('maps the shared Order shape to an explicit per-evaluation entity context', () => {
    expect(mapOrderContext({ id: 'ord-vip', vip: true, total: 149.95 })).toEqual({
      kind: 'Order',
      key: 'ord-vip',
      attributes: { Id: 'ord-vip', Vip: true, Total: 149.95 },
    })
  })
})
