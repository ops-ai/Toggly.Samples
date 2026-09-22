import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { context, createTogglyProvider, Toggly, type TogglyService } from '@ops-ai/react-feature-flags-toggly'
import { TelemetryPanel } from './TelemetryPanel'
import { createProviderOptions } from './sample-config'
import { FiltersMatrix, IdentityPanel, Snapshot } from './DemoPanels'
import { setSampleContext, useTogglyService } from './toggly'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

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
    let owner!: TogglyService
    function Capture() {
      const service = useTogglyService()
      useEffect(() => { owner = service! }, [service])
      return null
    }
    const host = render(<Provider><Capture /></Provider>)
    // Load definitions through the public context API before measuring one
    // explicit action; a refresh during an evaluation intentionally retires it.
    await act(() => owner.setContext({}))
    host.rerender(<Provider><TelemetryPanel enabled={enabled} /></Provider>)
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

async function contextHost() {
  const bodies: Record<string, any>[] = []
  let owner!: TogglyService
  let aliceEnabled = true
  vi.stubGlobal('CompressionStream', undefined)
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.hostname === 'metrics.test.invalid') {
      bodies.push(JSON.parse(String(init?.body)))
      return new Response('{}', { status: 202 })
    }
    const enabled = url.searchParams.get('userId') === 'alice' && aliceEnabled
    return new Response(JSON.stringify({ defs: { 'new-dashboard': { enabled, variant: enabled ? 'enabled' : 'disabled' } } }), { status: 200 })
  }))
  const Provider = await createTogglyProvider({
    ...createProviderOptions('test-only', 'Production', 'alice', { metricsBaseUrl: 'https://metrics.test.invalid' }),
    enableLiveUpdates: false, persistCache: false, verifySignatures: false,
  })
  function Capture() {
    const service = useTogglyService()
    useEffect(() => { owner = service! }, [service])
    return null
  }
  const view = render(<Provider><Capture /><IdentityPanel initialIdentity="alice" /><Snapshot /><FiltersMatrix /><TelemetryPanel enabled /></Provider>)
  await waitFor(() => expect(view.container.querySelector('#snapshot li')?.textContent).toBe('new-dashboard on'))
  return { bodies, owner, view, disableAlice: () => { aliceEnabled = false } }
}

it.each(['preset', 'identity', 'refresh'])('invalidates explicit selection on %s without adding usage/view checks', async transition => {
  const host = await contextHost()
  fireEvent.click(screen.getByRole('button', { name: 'Evaluate telemetry feature' }))
  await waitFor(() => expect(screen.getByText('Last evaluation: enabled')).toBeVisible())
  if (transition === 'preset') {
    fireEvent.click(screen.getByRole('button', { name: 'Apply non-matching preset' }))
    await waitFor(() => expect(screen.getByText(/Applied bob/)).toBeVisible())
  } else if (transition === 'identity') {
    fireEvent.change(screen.getByLabelText('Identity'), { target: { value: 'bob' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply session context' }))
    await waitFor(() => expect(screen.getByText(/Context changed and the SDK refreshed/)).toBeVisible())
  } else {
    host.disableAlice()
    await act(() => host.owner.setContext({ identity: 'alice' }))
  }
  await waitFor(() => expect(host.view.container.querySelector('#snapshot li')?.textContent).toBe('new-dashboard off'))
  expect(screen.getByRole('button', { name: 'Record usage' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Record view' })).toBeDisabled()
  expect(screen.getByText('Last evaluation: not evaluated')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Evaluate telemetry feature' }))
  await waitFor(() => expect(screen.getByText('Last evaluation: disabled')).toBeVisible())
  const checks = vi.spyOn(host.owner, 'isFeatureOn')
  for (const name of ['Record usage', 'Record view', 'Flush telemetry']) {
    fireEvent.click(screen.getByRole('button', { name }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Flush telemetry' })).toBeEnabled())
  }
  expect(checks).not.toHaveBeenCalled()
  expect(host.bodies.some(packet => packet.f?.['new-dashboard']?.enabled?.[1])).toBe(false)
  expect(host.bodies.some(packet => packet.f?.['new-dashboard']?.disabled?.[1] === 1)).toBe(true)
})

it('does not republish a delayed old evaluation after a new context and selection', async () => {
  const host = await contextHost()
  const evaluate = host.owner.isFeatureOn.bind(host.owner)
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const delayed = vi.spyOn(host.owner, 'isFeatureOn').mockImplementationOnce(async (...args) => {
    const oldResult = await evaluate(...args)
    await pending
    return oldResult
  })
  fireEvent.click(screen.getByRole('button', { name: 'Evaluate telemetry feature' }))
  await act(() => host.owner.setContext({ identity: 'bob' }))
  delayed.mockRestore()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Evaluate telemetry feature' })).toBeEnabled())
  expect(screen.getByRole('button', { name: 'Record usage' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Evaluate telemetry feature' }))
  await waitFor(() => expect(screen.getByText('Last evaluation: disabled')).toBeVisible())
  await act(async () => { release(); await pending })
  expect(screen.getByText('Last evaluation: disabled')).toBeVisible()
  expect(screen.queryByText('Last evaluation: enabled')).toBeNull()
})

it('retires the selection before a sample context refresh rejects', async () => {
  const host = await contextHost()
  fireEvent.click(screen.getByRole('button', { name: 'Evaluate telemetry feature' }))
  await waitFor(() => expect(screen.getByText('Last evaluation: enabled')).toBeVisible())
  vi.spyOn(host.owner, 'setContext').mockRejectedValueOnce(new Error('refresh rejected'))
  await act(async () => {
    await expect(setSampleContext(host.owner, { identity: 'bob' })).rejects.toThrow('refresh rejected')
  })
  expect(screen.getByRole('button', { name: 'Record usage' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Record view' })).toBeDisabled()
})

it('keeps a replacement owner selection when the previous owner resolves late', async () => {
  const oldOwner = new Toggly({ featureDefaults: { 'new-dashboard': true }, enableTelemetry: false })
  const newOwner = new Toggly({ featureDefaults: { 'new-dashboard': false }, enableTelemetry: false })
  const evaluate = oldOwner.isFeatureOn.bind(oldOwner)
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  vi.spyOn(oldOwner, 'isFeatureOn').mockImplementationOnce(async (...args) => {
    const result = await evaluate(...args)
    await pending
    return result
  })
  const host = render(<context.Provider value={{ toggly: oldOwner }}><TelemetryPanel enabled={false} /></context.Provider>)
  fireEvent.click(screen.getByRole('button', { name: 'Evaluate telemetry feature' }))
  host.rerender(<context.Provider value={{ toggly: newOwner }}><TelemetryPanel enabled={false} /></context.Provider>)
  expect(screen.getByRole('button', { name: 'Record usage' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Evaluate telemetry feature' }))
  await waitFor(() => expect(screen.getByText('Last evaluation: disabled')).toBeVisible())
  await act(async () => { release(); await pending })
  expect(screen.getByText('Last evaluation: disabled')).toBeVisible()
  host.unmount()
  oldOwner.dispose()
  newOwner.dispose()
})
