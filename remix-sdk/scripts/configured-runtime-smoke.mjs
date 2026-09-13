import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const port = '4317'
const serveCli = fileURLToPath(new URL('../node_modules/@remix-run/serve/dist/cli.js', import.meta.url))
const server = spawn(process.execPath, [serveCli, './build/server/index.js'], {
  env: {
    ...process.env,
    PORT: port,
    TOGGLY_APP_KEY: 'ci-placeholder',
    REMIX_PUBLIC_TOGGLY_APP_KEY: 'ci-placeholder',
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
  assert.match(await response.text(), /Remix SDK Sample/)
} finally {
  if (!server.killed) server.kill('SIGTERM')
  await serverExit
}
