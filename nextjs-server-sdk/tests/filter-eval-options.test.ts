import { describe, it, expect } from 'vitest'
import { buildFilterEvalOptions } from '@/lib/filter-eval-options'
import { claimsFromPreset } from '@/lib/filter-eval-cookies'

function getHeader(
  headers: Headers | Record<string, string | string[] | undefined> | undefined,
  name: string,
) {
  if (headers instanceof Headers) {
    return headers.get(name)
  }

  const value = headers?.[name]
  return Array.isArray(value) ? value.join(', ') : value
}

describe('claimsFromPreset', () => {
  it('maps admin and user presets', () => {
    expect(claimsFromPreset('admin')).toEqual({ role: 'admin' })
    expect(claimsFromPreset('user')).toEqual({ role: 'user' })
    expect(claimsFromPreset('none')).toBeUndefined()
  })
})

describe('buildFilterEvalOptions', () => {
  it('maps country cookie to cf-ipcountry header', () => {
    const opts = buildFilterEvalOptions({
      identity: 'alice',
      country: 'US',
      claimsPreset: 'admin',
      vip: true,
    })
    expect(opts.identity).toBe('alice')
    expect(opts.claims).toEqual({ role: 'admin' })
    expect(getHeader(opts.headers, 'cf-ipcountry')).toBe('US')
    expect(opts.contextKind).toBe('Order')
    expect(opts.context).toMatchObject({ id: 'ord-vip', vip: true })
  })

  it('uses non-vip order when vip is false', () => {
    const opts = buildFilterEvalOptions({ vip: false })
    expect(opts.context).toMatchObject({ id: 'ord-standard', vip: false })
  })

  it('omits headers and context when unset', () => {
    const opts = buildFilterEvalOptions({ identity: 'bob' })
    expect(opts.headers).toBeUndefined()
    expect(opts.context).toBeUndefined()
    expect(opts.claims).toBeUndefined()
  })

  it('passes user-agent and accept-language overrides', () => {
    const opts = buildFilterEvalOptions({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0',
      acceptLanguage: 'en-US,en;q=0.9',
      country: 'ca',
    })
    expect(getHeader(opts.headers, 'user-agent')).toContain('Chrome')
    expect(getHeader(opts.headers, 'accept-language')).toContain('en')
    expect(getHeader(opts.headers, 'cf-ipcountry')).toBe('CA')
  })
})
