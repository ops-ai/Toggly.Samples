import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { gunzipSync } from 'node:zlib'
import { once } from 'node:events'
import { connect } from 'node:net'
import { chromium } from 'playwright'
import { withOwnedResources } from './browser-cleanup.mjs'

if (process.argv[2] === 'all') {
  for (const mode of ['keyed', 'plain', 'optout', 'keyless']) {
    const result = spawnSync(process.execPath, [new URL(import.meta.url).pathname, mode], { stdio: 'inherit' })
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
  for (const mode of ['startup-reject', 'connect-reject', 'close-reject', 'close-stall']) {
    const result = spawnSync(process.execPath, [new URL(import.meta.url).pathname, mode], { encoding: 'utf8' })
    assert.equal(result.status, 1, `${mode} runner must exit nonzero: ${result.stderr}`)
    assert.match(result.stderr, mode === 'close-stall' ? /browser connection close timed out/ :
      mode === 'close-reject' ? /injected pre-shutdown browser.close rejection/ :
      mode === 'connect-reject' ? /injected connection startup rejection/ : /no-such-playwright-browser/)
    if (mode === 'close-reject' || mode === 'close-stall') {
      assert.match(result.stderr, /injected original browser assertion failure/)
      assert.match(result.stderr, /Resource cleanup failed/)
    }
    const ownership = result.stdout.match(/^OWNED_RESOURCES (.+)$/m)
    assert.ok(ownership, `${mode} runner must disclose its owned resources`)
    const { browserPid, nuxtPort, interceptorPort } = JSON.parse(ownership[1])
    if (browserPid) {
      assert.throws(() => process.kill(browserPid, 0), { code: 'ESRCH' }, `${mode} Chromium process exited`)
    }
    for (const [host, port] of [['localhost', nuxtPort], ['127.0.0.1', interceptorPort]]) {
      const code = await new Promise((resolve) => {
        const socket = connect({ host, port })
        socket.once('connect', () => { socket.destroy(); resolve('OPEN') })
        socket.once('error', (error) => resolve(error.code))
      })
      assert.equal(code, 'ECONNREFUSED', `${mode} closed ${host}:${port}`)
    }
    console.log(`${mode}: runner failed, owned browser process and both ports closed`)
  }
  process.exit(0)
}

const packets = []
const requests = []
const encodings = []
const mode = process.argv[2] ?? 'keyed'
const interceptor = createServer(async (request, response) => {
  requests.push(request.url)
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', '*')
  if (request.method === 'OPTIONS') { response.writeHead(204).end(); return }
  if (request.url === '/api/frontend/telemetry') {
    encodings.push(request.headers['content-encoding'] ?? 'plain')
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = Buffer.concat(chunks)
    packets.push(JSON.parse((request.headers['content-encoding'] === 'gzip' ? gunzipSync(body) : body).toString()))
    response.writeHead(202).end()
    return
  }
  response.setHeader('Content-Type', 'application/json')
  response.writeHead(200).end(JSON.stringify({
    defs: { 'new-dashboard': true, 'api-v2': true, 'enhanced-submit': true, ExpressCheckout: true },
  }))
})
interceptor.listen(0, '127.0.0.1')
await once(interceptor, 'listening')
const interceptorPort = interceptor.address().port
const portReservation = createServer()
portReservation.listen(0, 'localhost')
await once(portReservation, 'listening')
const appPort = portReservation.address().port
await new Promise((resolve) => portReservation.close(resolve))
const endpoint = `http://127.0.0.1:${interceptorPort}`
const appUrl = `http://localhost:${appPort}`
const child = spawn(process.execPath, ['node_modules/nuxt/bin/nuxt.mjs', 'dev', '--port', String(appPort)], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    TOGGLY_APP_KEY: mode === 'keyless' ? '' : 'public-consumer-test',
    TOGGLY_ENVIRONMENT: 'Production',
    TOGGLY_ENABLE_TELEMETRY: mode === 'optout' ? 'false' : 'true',
    TOGGLY_ENABLE_LIVE_UPDATES: 'false',
    TOGGLY_BASE_URI: endpoint,
    TOGGLY_METRICS_BASE_URL: endpoint,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let logs = ''
child.stdout.on('data', (chunk) => { logs += chunk })
child.stderr.on('data', (chunk) => { logs += chunk })
const resources = { browser: null, browserServer: null, child, interceptor }
if (mode === 'startup-reject') {
  console.log(`OWNED_RESOURCES ${JSON.stringify({ nuxtPort: appPort, interceptorPort })}`)
}
await withOwnedResources(async () => {
  let ready = false
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error(`Nuxt exited: ${logs}`)
    try {
      const response = await fetch(`${appUrl}/api/snapshot?preset=matching`)
      if (response.ok) { ready = true; break }
    } catch { /* dev server still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert.ok(ready, `Nuxt did not serve snapshot: ${logs}`)
  assert.equal(packets.length, 0, 'SSR and Nitro requests stay silent')
  const executablePath = mode === 'startup-reject'
    ? '/no-such-playwright-browser'
    : process.env.TOGGLY_TEST_CHROMIUM_EXECUTABLE
  resources.browserServer = await chromium.launchServer({ ...(executablePath ? { executablePath } : {}), headless: true })
  if (mode === 'connect-reject') {
    console.log(`OWNED_RESOURCES ${JSON.stringify({ browserPid: resources.browserServer.process().pid, nuxtPort: appPort, interceptorPort })}`)
    throw new Error('injected connection startup rejection')
  }
  resources.browser = await chromium.connect(resources.browserServer.wsEndpoint())
  const browser = resources.browser
  if (mode === 'close-reject' || mode === 'close-stall') {
    console.log(`OWNED_RESOURCES ${JSON.stringify({
      browserPid: resources.browserServer.process().pid,
      nuxtPort: appPort,
      interceptorPort,
    })}`)
    browser.close = mode === 'close-reject'
      ? async () => { throw new Error('injected pre-shutdown browser.close rejection') }
      : () => new Promise(() => {})
    throw new Error('injected original browser assertion failure')
  }
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(String(error)))
  if (mode === 'plain') await page.addInitScript(() => { window.CompressionStream = undefined })
  await page.goto(appUrl)
  assert.deepEqual(pageErrors, [], 'browser module loaded')
  await page.getByRole('button', { name: 'Evaluate enhanced-submit and this Order' }).click()
  await page.getByRole('button', { name: 'Record demo usage, view, counter and gauge' }).click()
  await page.getByText('Browser telemetry flushed for this demo action.').waitFor()
  if (mode === 'keyless' || mode === 'optout') {
    assert.deepEqual(packets, [], `${mode} emits no browser packet`)
  } else {
    assert.ok(packets.length > 0, 'browser emitted a compact packet')
    assert.ok(packets.some((packet) => packet.k === 'public-consumer-test' && packet.e === 'Production'))
    assert.ok(packets.some((packet) => packet.m?.['demo-actions'] === 1 && packet.m?.['demo-cart-size'] === 3))
    assert.ok(packets.some((packet) => packet.f?.['enhanced-submit']?.disabled && packet.f?.['enhanced-submit']?.enabled), 'direct/gate checks and explicit usage retain result attribution')
    assert.ok(packets.some((packet) => packet.f?.['new-dashboard']), 'view attributed to the feature')
    assert.ok(encodings.includes(mode === 'plain' ? 'plain' : 'gzip'))
    // The first action changes its status text. After draining setup checks,
    // that UI update must not make the sibling v-feature directive reevaluate.
    packets.length = 0
    await page.getByRole('button', { name: 'Record demo usage, view, counter and gauge' }).click()
    for (let attempt = 0; attempt < 20 && packets.length === 0; attempt++) await page.waitForTimeout(50)
    const afterFirstStatus = packets.at(-1)
    assert.ok(afterFirstStatus, 'first status update flushed a packet')
    const featureChecks = (packet) => Object.values(packet.f ?? {}).reduce(
      (total, variants) => total + Object.values(variants).reduce((sum, counts) => sum + (counts[0] ?? 0), 0), 0,
    )
    assert.equal(featureChecks(afterFirstStatus), 0, 'telemetry status update adds no feature checks')
    assert.deepEqual(afterFirstStatus.m, { 'demo-actions': 1, 'demo-cart-size': 3 })
    assert.equal(afterFirstStatus.f?.['enhanced-submit']?.enabled?.[1], 1, 'usage is exact')
    assert.equal(afterFirstStatus.f?.['new-dashboard']?.enabled?.[2], 1, 'view is exact')
    packets.length = 0
    await page.getByRole('button', { name: 'Record demo usage, view, counter and gauge' }).click()
    for (let attempt = 0; attempt < 20 && packets.length === 0; attempt++) await page.waitForTimeout(50)
    assert.equal(featureChecks(packets.at(-1)), 0, 'repeat action adds no feature checks')
    await page.getByRole('textbox', { name: 'Browser identity' }).fill('bob')
    await page.getByRole('button', { name: 'Apply browser identity' }).click()
    await page.getByText('Browser identity is now bob.').waitFor()
    await page.getByRole('button', { name: 'Record demo usage, view, counter and gauge' }).click()
    for (let attempt = 0; attempt < 20 && !packets.some((packet) => packet.u === 'bob'); attempt++) {
      await page.waitForTimeout(50)
    }
    assert.ok(packets.some((packet) => packet.u === 'bob'), 'new browser context labels its own packet')
    const deliveredBeforePagehide = packets.length
    await page.getByRole('button', { name: 'Evaluate enhanced-submit and this Order' }).click()
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
    for (let attempt = 0; attempt < 20 && packets.length === deliveredBeforePagehide; attempt++) {
      await page.waitForTimeout(50)
    }
    assert.ok(packets.length > deliveredBeforePagehide, 'pagehide starts a final browser flush')
  }
  console.log(JSON.stringify({ mode, packetCount: packets.length, encodings, packets, endpoint, requests }, null, 2))
}, resources)
