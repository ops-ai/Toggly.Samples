import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const sample = dirname(dirname(fileURLToPath(import.meta.url)))
const require = createRequire(join(sample, 'package.json'))
const lock = JSON.parse(readFileSync(join(sample, 'package-lock.json'), 'utf8'))
const sdk = lock.packages['node_modules/@ops-ai/electron-feature-flags-toggly']
assert.equal(sdk.version, '1.1.0')
assert.match(sdk.resolved, /^https:\/\/registry\.npmjs\.org\//)
assert.match(sdk.integrity, /^sha512-/)
const executable = realpathSync(require('electron'))
const workspace = mkdtempSync(join(tmpdir(), 'toggly-electron-public-host-'))

async function run(mode) {
  const reportPath = join(workspace, `${mode}.json`)
  const environment = {
    ...process.env,
    TOGGLY_APP_KEY: mode === 'keyless' ? '' : 'electron-public-host-test-key',
    TOGGLY_DISABLE_TELEMETRY: mode === 'optout' ? 'true' : 'false',
    TOGGLY_SAMPLE_HOST_REPORT: reportPath,
    TOGGLY_SAMPLE_HOST_MODE: mode,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  }
  const [command, args] = process.platform === 'darwin'
    ? ['/usr/bin/open', [
      '-W', '-n', '-g',
      ...Object.entries(environment)
        .filter(([key]) => key.startsWith('TOGGLY_') || key === 'ELECTRON_DISABLE_SECURITY_WARNINGS')
        .flatMap(([key, value]) => ['--env', `${key}=${value}`]),
      dirname(dirname(dirname(executable))), '--args', sample,
    ]]
    : [executable, [sample, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])]]

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: sample, env: environment, stdio: 'pipe' })
    let output = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    const timeout = setTimeout(() => child.kill('SIGTERM'), 35_000)
    child.once('error', error => { clearTimeout(timeout); reject(error) })
    child.once('close', code => {
      clearTimeout(timeout)
      if (code !== 0) reject(new Error(`${mode}: Electron exited ${code}\n${output}`))
      else resolve(code)
    })
  })
  assert.equal(exitCode, 0)
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))
  assert.equal(report.passed, true, JSON.stringify(report))
  assert.equal(report.bridge, 'object')
  assert.equal(report.nodeProcess, 'undefined')
  assert.equal(report.hookIsDisabled, true)
  assert.equal(report.negatedFeature, true)
  assert.equal(report.defaults['new-dashboard'], false)
  assert.equal(report.packets.length, mode === 'enabled' ? 1 : 0)
  if (mode !== 'keyless') {
    assert.deepEqual(report.telemetry, { direct: false, gate: false, flush: 'function' })
  }
  if (mode === 'enabled') {
    const packet = report.packets[0]
    console.log(`PUBLIC_ELECTRON_PACKET ${JSON.stringify(packet)}`)
    assert.equal(packet.k, 'electron-public-host-test-key')
    assert.equal(packet.e, 'Production')
    assert.equal(typeof packet.f, 'object')
    assert.equal(typeof packet.m, 'object')
    assert.ok(packet.f['new-dashboard'].disabled[0] >= 1)
    assert.equal(packet.f['new-dashboard'].disabled[1], 1)
    assert.ok(packet.f['api-v2'].disabled[0] >= 1)
    assert.deepEqual(packet.f.Cart.blue, [0, 0, 1])
    assert.deepEqual(packet.m, { orders: 2, cartItems: 3 })
    assert.equal(packet.f.invalid, undefined)
    assert.equal(packet.m.negative, undefined)
  }
  console.log(`PUBLIC_ELECTRON_${mode.toUpperCase()}_HOST_PASS`)
}

try {
  for (const mode of ['keyless', 'optout', 'enabled']) await run(mode)
} finally {
  rmSync(workspace, { recursive: true, force: true })
}
