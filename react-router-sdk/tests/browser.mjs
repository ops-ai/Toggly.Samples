import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined })
const servers = []

async function start(port, appKey, telemetry = true) {
  // This browser proof exercises only the published app-owned client. Keep the
  // server SDK unconfigured so neither definitions nor server telemetry can
  // reach a live service during the test.
  process.env.TOGGLY_APP_KEY = ''
  process.env.TOGGLY_ENVIRONMENT = 'Production'
  process.env.VITE_TOGGLY_APP_KEY = appKey
  process.env.VITE_TOGGLY_ENVIRONMENT = 'Production'
  process.env.VITE_TOGGLY_ENABLE_TELEMETRY = telemetry ? 'true' : 'false'
  process.env.VITE_TOGGLY_METRICS_BASE_URL = 'https://telemetry.test.invalid'
  const server = await createServer({
    root,
    mode: 'test',
    envDir: false,
    clearScreen: false,
    server: { host: '127.0.0.1', port, strictPort: true },
  })
  await server.listen()
  servers.push(server)
  return `http://127.0.0.1:${port}`
}

function decodePacket(request) {
  const bytes = request.postDataBuffer()
  const decoded = request.headers()['content-encoding'] === 'gzip' ? gunzipSync(bytes) : bytes
  return JSON.parse(decoded.toString('utf8'))
}

async function capture(page, packets, definitionUsers, isNewDashboardEnabled = () => true) {
  await page.route('https://definitions.toggly.io/**', async (route) => {
    const url = new URL(route.request().url())
    definitionUsers.push({
      identity: url.searchParams.get('u'),
      groups: url.searchParams.getAll('g'),
      role: url.searchParams.get('claim.role'),
    })
    await route.fulfill({
      json: {
        'new-dashboard': isNewDashboardEnabled(),
        'api-v2': true,
        'enhanced-submit': false,
        'beta-access': false,
      },
    })
  })
  await page.route('https://telemetry.test.invalid/**', async (route) => {
    const request = route.request()
    assert.equal(request.method(), 'POST')
    packets.push(decodePacket(request))
    await route.fulfill({ status: 202, body: '' })
  })
}

function effectiveCheckCount(packets, identity) {
  return packets
    .filter((packet) => packet.u === identity)
    .reduce((total, packet) => total + Object.values(packet.f || {}).reduce(
      (featureTotal, variants) => featureTotal + Object.values(variants).reduce(
        (variantTotal, counts) => variantTotal + (counts[0] || 0),
        0,
      ),
      0,
    ), 0)
}

function assertIdentityEvents(packets, identity, expectedActions = 1) {
  const owned = packets.filter((packet) => packet.u === identity)
  assert.ok(owned.length, `${identity} has an independently attributed packet`)
  const feature = owned.map((packet) => packet.f?.['new-dashboard']?.enabled).filter(Boolean)
  assert.ok(feature.some((values) => values[0] > 0), `${identity} packet contains automatic feature checks`)
  assert.equal(feature.reduce((total, values) => total + (values[1] || 0), 0), expectedActions, `${identity} owns the expected usage events`)
  assert.equal(feature.reduce((total, values) => total + (values[2] || 0), 0), expectedActions, `${identity} owns the expected view events`)
  assert.ok(
    owned.some((packet) =>
      packet.m?.['router-sample-actions'] === 1 && packet.m?.['router-sample-cart-size'] === 3,
    ),
    `${identity} packet contains the explicit counter and gauge`,
  )
}

function assertDisabledIdentityEvents(packets, identity) {
  const disabled = packets
    .filter((packet) => packet.u === identity)
    .map((packet) => packet.f?.['new-dashboard']?.disabled)
    .filter(Boolean)
  assert.equal(disabled.reduce((total, values) => total + (values[1] || 0), 0), 1, `${identity} owns one disabled usage event`)
  assert.equal(disabled.reduce((total, values) => total + (values[2] || 0), 0), 1, `${identity} owns one disabled view event`)
}

try {
  const packets = []
  const definitionUsers = []
  let newDashboardEnabled = true
  const page = await browser.newPage()
  await capture(page, packets, definitionUsers, () => newDashboardEnabled)
  await page.routeWebSocket('wss://definitions.toggly.io/**', (socket) => {
    socket.close({ code: 1000, reason: 'isolated browser test' })
  })
  const baseUrl = await start(5178, 'test-only-not-a-real-key')

  // Hold the browser entry modules after the server-rendered document arrives.
  // A telemetry POST during this interval would mean SSR owns browser transport.
  let releaseScripts
  const scriptGate = new Promise((resolve) => { releaseScripts = resolve })
  let scriptsReleased = false
  await page.route((url) => {
    const path = new URL(url).pathname
    return path === '/@vite/client' || path.endsWith('.tsx')
  }, async (route) => {
    if (!scriptsReleased) await scriptGate
    await route.continue()
  })
  const response = await page.goto(`${baseUrl}/gates`, { waitUntil: 'domcontentloaded' })
  assert.equal(response?.status(), 200)
  await expect(page.getByTestId('new-dashboard-result')).toHaveText('false')
  await page.waitForTimeout(150)
  assert.deepEqual(packets, [], 'server-rendered HTML emits no browser telemetry')
  scriptsReleased = true
  releaseScripts()

  await expect(page.getByTestId('new-dashboard-result')).toHaveText('true')
  await expect(page.getByText('Negate: legacy dashboard is shown while the flag is OFF.')).toHaveCount(0)
  await expect(page.getByText('Multi-key all gate: both new-dashboard and api-v2 are on.')).toBeVisible()
  await expect(page.getByText(/boolean-mapped “variant”: modern/)).toBeVisible()

  await page.getByTestId('identify-alice').click()
  await expect(page.getByTestId('client-identity')).toHaveText('alice')
  await expect.poll(() => definitionUsers.some((context) => context.identity === 'alice')).toBe(true)
  assert.ok(definitionUsers.some((context) => context.identity === 'alice' && context.groups.includes('beta') && context.role === 'admin'))
  let before = packets.length
  await page.getByTestId('record-telemetry').click()
  await expect(page.getByTestId('telemetry-status')).toContainText('alice')
  await expect.poll(() => packets.length).toBeGreaterThan(before)
  const aliceChecksBeforeSecondAction = effectiveCheckCount(packets, 'alice')
  before = packets.length
  await page.getByTestId('record-telemetry').click()
  await expect.poll(() => packets.length).toBeGreaterThan(before)
  assert.equal(
    effectiveCheckCount(packets.slice(before), 'alice'),
    0,
    'same-identity explicit events and local status updates add no feature checks',
  )
  assert.ok(aliceChecksBeforeSecondAction > 0, 'Alice has an automatic-check baseline')
  assertIdentityEvents(packets, 'alice', 2)

  // A genuine same-identity refresh changes the authoritative result. Drain
  // automatic checks first, then prove explicit events use the current OFF
  // result without triggering another evaluation.
  const aliceDefinitionsBeforeRefresh = definitionUsers.filter((context) => context.identity === 'alice').length
  newDashboardEnabled = false
  await page.getByTestId('refresh-browser-flags').click()
  await expect(page.getByTestId('new-dashboard-result')).toHaveText('false')
  await expect(page.getByText('Negate: legacy dashboard is shown while the flag is OFF.')).toBeVisible()
  await expect.poll(() => definitionUsers.filter((context) => context.identity === 'alice').length)
    .toBeGreaterThan(aliceDefinitionsBeforeRefresh)
  before = packets.length
  await page.getByTestId('flush-browser-telemetry').click()
  await expect.poll(() => packets.length).toBeGreaterThan(before)
  const aliceChecksBeforeOffAction = effectiveCheckCount(packets, 'alice')
  before = packets.length
  await page.getByTestId('record-telemetry').click()
  await expect(page.getByTestId('telemetry-status')).toContainText('alice')
  await expect.poll(() => packets.length).toBeGreaterThan(before)
  assert.equal(effectiveCheckCount(packets.slice(before), 'alice'), 0, 'OFF explicit events add no feature checks')
  assertDisabledIdentityEvents(packets.slice(before), 'alice')

  newDashboardEnabled = true
  await page.getByTestId('identify-bob').click()
  await expect(page.getByTestId('client-identity')).toHaveText('bob')
  await expect.poll(() => definitionUsers.some((context) => context.identity === 'bob')).toBe(true)
  assert.ok(definitionUsers.some((context) => context.identity === 'bob' && context.groups.length === 0 && context.role === 'user'))
  before = packets.length
  await page.getByTestId('record-telemetry').click()
  await expect(page.getByTestId('telemetry-status')).toContainText('bob')
  await expect.poll(() => packets.length).toBeGreaterThan(before)
  assert.ok(aliceChecksBeforeOffAction > aliceChecksBeforeSecondAction, 'same-identity refresh produced a fresh automatic-check baseline')
  assertIdentityEvents(packets, 'bob')
  assert.ok(packets.every((packet) => packet.k === 'test-only-not-a-real-key'))
  await page.close()

  for (const [port, appKey, telemetry, expected] of [
    [5179, '', true, 'false'],
    [5180, 'test-only-not-a-real-key', false, 'true'],
  ]) {
    const silentPackets = []
    const silentUsers = []
    const silentPage = await browser.newPage()
    await capture(silentPage, silentPackets, silentUsers)
    await silentPage.routeWebSocket('wss://definitions.toggly.io/**', (socket) => {
      socket.close({ code: 1000, reason: 'isolated browser test' })
    })
    await silentPage.goto(`${await start(port, appKey, telemetry)}/gates`)
    await expect(silentPage.getByTestId('new-dashboard-result')).toHaveText(expected)
    await silentPage.getByTestId('identify-bob').click()
    await expect(silentPage.getByTestId('client-identity')).toHaveText('bob')
    await silentPage.getByTestId('record-telemetry').click()
    await expect(silentPage.getByTestId('telemetry-status')).toContainText('bob')
    await silentPage.waitForTimeout(100)
    assert.deepEqual(silentPackets, [], appKey ? 'opt-out sends no browser packets' : 'keyless mode sends no browser packets')
    await silentPage.close()
  }

  console.log('React Router browser checks passed: SSR packet silence, public client gates, alice/bob isolation, enabled/OFF explicit usage and view, zero-check explicit actions, keyless silence, and opt-out silence')
} finally {
  await browser.close()
  await Promise.all(servers.map((server) => server.close()))
}
