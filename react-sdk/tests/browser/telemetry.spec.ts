import { expect, test } from '@playwright/test'
import { gunzipSync } from 'node:zlib'

test('published provider emits explicit compact events and honors collection policy', async ({ page }, info) => {
  const packets: { k: string; e: string; f: Record<string, Record<string, number[]>>; m?: Record<string, number> }[] = []
  const external: string[] = []
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === '127.0.0.1') return route.continue()
    external.push(url.hostname)
    if (url.hostname === 'metrics.test.invalid' && url.pathname === '/api/frontend/telemetry') {
      const body = request.postDataBuffer()!
      packets.push(JSON.parse(request.headers()['content-encoding'] === 'gzip' ? gunzipSync(body).toString() : body.toString()))
      return route.fulfill({ status: 202, headers: { 'access-control-allow-origin': '*' } })
    }
    if (url.hostname === 'definitions.toggly.io' && url.pathname.includes('/evaluated-variants-signed/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ defs: { 'new-dashboard': false } }) })
    }
    // Unexpected external requests remain blocked.
    return route.fulfill({ status: 403, body: '{}' })
  })
  await page.routeWebSocket(/.*/, socket => {
    if (new URL(socket.url()).hostname === '127.0.0.1') socket.connectToServer()
    else socket.close()
  })
  await page.goto('/')
  const panel = page.locator('#telemetry')
  await expect(panel.getByRole('heading', { name: 'Browser telemetry' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'React SDK Showcase' })).toBeVisible()
  await expect(page.getByText('loading…', { exact: true })).toHaveCount(0)
  const flush = async () => {
    const button = panel.getByRole('button', { name: 'Flush telemetry', exact: true })
    await button.click()
    await expect(button).toBeEnabled()
    await expect(panel.getByRole('status')).toHaveText(/Flush attempted/)
  }
  await flush()
  if (info.project.name === 'enabled') {
    // Concurrent initial SDK evaluations wait on 100 ms callbacks. UI loading
    // alone does not prove those checks have reached the owner's buffer.
    // Require two quiet flushes on separate polls; fail if startup never settles.
    let quietFlushes = 0
    let attempts = 0
    await expect.poll(async () => {
      if (++attempts > 8) throw new Error('Initial showcase telemetry did not settle after eight flushes')
      const before = packets.length
      await flush()
      quietFlushes = packets.length === before ? quietFlushes + 1 : 0
      return quietFlushes
    }, { timeout: 5_000, intervals: [100, 250, 500], message: 'Initial showcase checks must drain before measuring explicit interactions' }).toBe(2)

    expect(packets.length).toBeGreaterThan(0)
    // Existing showcase evaluations are checks; rendering the new panel is not a view/usage.
    for (const packet of packets) for (const variants of Object.values(packet.f ?? {})) for (const values of Object.values(variants)) expect([values[1] ?? 0, values[2] ?? 0]).toEqual([0, 0])
  }
  packets.length = 0
  await panel.getByRole('button', { name: 'Evaluate telemetry feature' }).click()
  await expect(panel.getByText('Last evaluation: disabled', { exact: true })).toBeVisible()
  for (const name of ['Record usage', 'Record view', 'Increment counter', 'Set gauge']) await panel.getByRole('button', { name, exact: true }).click()
  await flush()
  if (info.project.name === 'enabled') {
    expect(packets).toHaveLength(1)
    expect(packets[0]).toMatchObject({ k: 'telemetry-test-only', e: 'Production', f: { 'new-dashboard': { disabled: [1, 1, 1] } }, m: { 'sample-actions': 1, 'sample-cart-size': 3 } })
    expect(Object.keys(packets[0]).every(key => ['k', 'e', 'u', 'i', 'f', 'm'].includes(key))).toBe(true)
  } else {
    expect(packets).toEqual([])
    await expect(panel.getByText(/Collection is off/)).toBeVisible()
    if (info.project.name === 'no-key') expect(external).toEqual([])
  }
})
