import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTogglyProvider } from '@ops-ai/react-feature-flags-toggly'
import { TelemetryPanel } from './TelemetryPanel'
import { createProviderOptions } from './sample-config'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('published React telemetry owner', () => {
  it.each([true, false])('uses explicit interactions with collection=%s', async enabled => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/api/frontend/telemetry')) {
        bodies.push(JSON.parse(String(init?.body)))
        return new Response('{}', { status: 202 })
      }
      return new Response(JSON.stringify({ defs: { 'new-dashboard': false } }), { status: 200 })
    }))
    // Plain serialization is exercised here; actual Chrome verifies compressed requests.
    vi.stubGlobal('CompressionStream', undefined)
    const Provider = await createTogglyProvider({
      ...createProviderOptions('test-only', 'Production', 'sample-test', { enableTelemetry: enabled, metricsBaseUrl: 'https://metrics.test.invalid' }),
      enableLiveUpdates: false, persistCache: false, verifySignatures: false,
    })
    render(<Provider><TelemetryPanel enabled={enabled} /></Provider>)
    expect(bodies).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate telemetry feature' }))
    await waitFor(() => expect(screen.getByText('Last evaluation: disabled')).toBeVisible())
    for (const name of ['Record usage', 'Record view', 'Increment counter', 'Set gauge']) {
      fireEvent.click(screen.getByRole('button', { name }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Flush telemetry' })).toBeEnabled())
    }
    fireEvent.click(screen.getByRole('button', { name: 'Flush telemetry' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Flush attempted'))
    if (enabled) expect(bodies).toEqual([{ k: 'test-only', e: 'Production', u: 'sample-test', f: { 'new-dashboard': { disabled: [1, 1, 1] } }, m: { 'sample-actions': 1, 'sample-cart-size': 3 } }])
    else expect(bodies).toEqual([])
  })
})
