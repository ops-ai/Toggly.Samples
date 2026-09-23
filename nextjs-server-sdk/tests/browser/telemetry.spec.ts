import { test, expect } from '@playwright/test'
import { gunzipSync } from 'node:zlib'

const noKey = process.env.TELEMETRY_TEST_NO_KEY === '1'

for (const encodingMode of ['gzip', 'plain'] as const) {
  test(`published browser owner records compact ${encodingMode} events and respects opt-out`, async ({ page }) => {
  if (encodingMode === 'plain') {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'CompressionStream', { value: undefined })
    })
  }
  const packets: Record<string, unknown>[] = []
  const encodings: string[] = []
  const external: string[] = []
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === '127.0.0.1') return route.continue()
    external.push(url.hostname)
    if (url.hostname === 'metrics.test.invalid' && url.pathname === '/api/frontend/telemetry') {
      const body = request.postDataBuffer()!
      const encoding = request.headers()['content-encoding'] || 'plain'
      encodings.push(encoding)
      packets.push(JSON.parse(encoding === 'gzip' ? gunzipSync(body).toString() : body.toString()))
      return route.fulfill({ status: 202, headers: { 'access-control-allow-origin': '*' } })
    }
    // No real definitions, JWKS or metrics requests can escape this fixture.
    return route.fulfill({ status: 403, body: '{}' })
  })
  await page.routeWebSocket(/.*/, socket => {
    if (new URL(socket.url()).hostname !== '127.0.0.1') socket.close()
    else socket.connectToServer()
  })
  await page.goto('/client/telemetry')
  await expect(page.getByRole('heading', { name: 'Browser telemetry', exact: true })).toBeVisible()
  if (noKey) {
    await expect(page.getByText('Telemetry controls require a public app key.')).toBeVisible()
    expect(await page.getByRole('button', { name: 'Record usage', exact: true }).count()).toBe(0)
    expect(external).toEqual([])
    expect(packets).toEqual([])
    return
  }
  await expect(page.getByRole('button', { name: 'Evaluate feature', exact: true })).toBeEnabled()
  expect(packets).toEqual([])
  await page.getByRole('button', { name: 'Evaluate feature', exact: true }).click()
  await expect(page.getByText('Last evaluation: disabled', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Record usage', exact: true }).click()
  await page.getByRole('button', { name: 'Record view', exact: true }).click()
  await page.getByRole('button', { name: 'Increment counter', exact: true }).click()
  await page.getByRole('button', { name: 'Set gauge', exact: true }).click()
  await page.getByRole('button', { name: 'Flush telemetry', exact: true }).click()
  await expect.poll(() => packets.length).toBe(1)
  expect(packets[0]).toMatchObject({ k: 'telemetry-test-only', e: 'Production', f: { 'new-dashboard': { disabled: [1, 1, 1] } }, m: { 'sample-interactions': 1, 'sample-cart-value': 42 } })
  expect(encodings).toEqual([encodingMode])
  console.log(`Intercepted compact telemetry fields: ${Object.keys(packets[0]).sort().join(',')}; encoding: ${encodings.join(',')}`)
  // Report optional wire fields separately; their acceptance policy is unresolved.
  await page.getByLabel('Collect browser telemetry').click()
  await expect(page.getByText('Collection is off.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Collect browser telemetry')).not.toBeChecked()
  await page.getByRole('button', { name: 'Evaluate feature', exact: true }).click()
  for (const name of ['Record usage', 'Record view', 'Increment counter', 'Set gauge', 'Flush telemetry']) await page.getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Flush attempted' })).toBeVisible()
  expect(packets).toHaveLength(1)
  })
}

test('published browser flag and gate surfaces remain available', async ({ page }) => {
  test.skip(noKey, 'keyless mode does not mount browser feature controls')
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue()
    : route.fulfill({ status: 403, body: '{}' }))
  await page.routeWebSocket(/.*/, socket => {
    if (new URL(socket.url()).hostname !== '127.0.0.1') socket.close()
    else socket.connectToServer()
  })
  await page.goto('/client/hooks')
  await expect(page.getByText('isEnabled: OFF')).toBeVisible()
  await expect(page.getByText('all (new-dashboard + api-v2): OFF')).toBeVisible()
  await expect(page.getByText('any: OFF', { exact: true })).toBeVisible()
  await page.goto('/client/components')
  await expect(page.getByText('Feature negate: new-dashboard OFF')).toBeVisible()
  await expect(page.getByText('Gate failed (not both ON)')).toBeVisible()
  await expect(page.getByText('Variant disabled')).toBeVisible()
})
