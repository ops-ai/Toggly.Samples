import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const port = '4317'
const serveCli = fileURLToPath(new URL('../node_modules/@remix-run/serve/dist/cli.js', import.meta.url))
const serverOnlyKey = 'ci-server-only-placeholder'
const server = spawn(process.execPath, [serveCli, './build/server/index.js'], {
  env: {
    ...process.env,
    PORT: port,
    TOGGLY_APP_KEY: serverOnlyKey,
    REMIX_PUBLIC_TOGGLY_APP_KEY: 'ci-public-placeholder',
    TOGGLY_ENVIRONMENT: 'Production',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
const serverExit = once(server, 'exit')

let output = ''
server.stdout.on('data', (chunk) => { output += chunk })
server.stderr.on('data', (chunk) => { output += chunk })

try {
  let response
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/`)
      if (response.ok) break
    } catch {
      // The server is still starting; retry within the short bounded window.
    }
    await delay(250)
  }

  assert.ok(response, `Configured server did not respond.\n${output}`)
  assert.equal(response.status, 200, `Configured key must not yield a 500.\n${output}`)
  const home = await response.text()
  assert.match(home, /Remix SDK Sample/)
  assert.doesNotMatch(home, new RegExp(serverOnlyKey))

  const validIdentity = await fetch(`http://127.0.0.1:${port}/identity`, {
    headers: { cookie: 'session=a; toggly-identity=alice' },
  })
  assert.equal(validIdentity.status, 200, `Valid multi-cookie identity must not return 500.\n${output}`)
  assert.match(await validIdentity.text(), /"identity":\s*"alice"/)

  const malformedIdentity = await fetch(`http://127.0.0.1:${port}/identity`, {
    headers: { cookie: 'session=a; toggly-identity=%' },
  })
  assert.equal(malformedIdentity.status, 200, `Malformed identity cookie must not return 500.\n${output}`)
} finally {
  if (!server.killed) server.kill('SIGTERM')
  await serverExit
}
