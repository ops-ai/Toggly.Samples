import React from 'react'
import { renderToString } from 'react-dom/server'
import { TogglyProvider } from '@ops-ai/nextjs-toggly-client'
import { afterEach, expect, it, vi } from 'vitest'
import { TelemetryDemo } from '../components/telemetry-demo'

afterEach(() => vi.unstubAllGlobals())

it('renders browser telemetry controls during SSR without sending requests', () => {
  const fetch = vi.fn(() => { throw new Error('SSR must not send telemetry') })
  vi.stubGlobal('fetch', fetch)
  const html = renderToString(<TogglyProvider config={{ appKey: 'ssr-test-only', enableTelemetry: true }}><TelemetryDemo /></TogglyProvider>)
  expect(html).toContain('Record usage')
  expect(html).toContain('Evaluate feature')
  expect(fetch).not.toHaveBeenCalled()
})
