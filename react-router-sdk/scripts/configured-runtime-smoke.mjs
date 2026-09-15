import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const port = '4318'
const serveCli = fileURLToPath(new URL('../node_modules/@react-router/serve/dist/cli.js', import.meta.url))
const serverOnlyKey = 'ci-server-only-placeholder'
const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: port,
  TOGGLY_APP_KEY: serverOnlyKey,
  VITE_TOGGLY_APP_KEY: 'ci-public-placeholder',
  TOGGLY_ENVIRONMENT: 'Production',
}
delete env.HOST
const server = spawn(process.execPath, [serveCli, './build/server/index.js'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
})
const serverExit = once(server, 'exit')

let output = ''
server.stdout.on('data', (chunk) => { output += chunk })
server.stderr.on('data', (chunk) => { output += chunk })

const watchdog = setTimeout(() => {
  server.kill('SIGKILL')
  console.error(`Smoke timed out.\n${output}`)
  process.exit(1)
}, 25000)

try {
  let response
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2000) })
      if (response.ok) break
    } catch {
      // The server is still starting; retry within the short bounded window.
    }
    await delay(250)
  }

  assert.ok(response, `Configured server did not respond.\n${output}`)
  assert.equal(response.status, 200, `Configured key must not yield a 500.\n${output}`)
  const home = await response.text()
  assert.match(home, /React Router SDK Sample/)
  assert.doesNotMatch(home, new RegExp(serverOnlyKey))

  const validIdentity = await fetch(`http://127.0.0.1:${port}/identity`, {
    headers: { cookie: 'session=a; toggly-identity=alice' },
    signal: AbortSignal.timeout(5000),
  })
  assert.equal(validIdentity.status, 200, `Valid multi-cookie identity must not return 500.\n${output}`)
  const identityHtml = (await validIdentity.text()).replaceAll('&quot;', '"')
  assert.match(identityHtml, /"identity":\s*"alice"/)

  const malformedIdentity = await fetch(`http://127.0.0.1:${port}/identity`, {
    headers: { cookie: 'session=a; toggly-identity=%' },
    signal: AbortSignal.timeout(5000),
  })
  assert.equal(malformedIdentity.status, 200, `Malformed identity cookie must not return 500.\n${output}`)
} finally {
  clearTimeout(watchdog)
  server.kill('SIGTERM')
  const forceKill = setTimeout(() => {
    // Toggly live-update sockets can keep the serve process alive after SIGTERM.
    server.kill('SIGKILL')
  }, 1500)
  await serverExit
  clearTimeout(forceKill)
}
