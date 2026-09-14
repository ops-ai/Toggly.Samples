import { afterEach, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const children: ChildProcess[] = []
const temporaryRoots: string[] = []

async function freePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Could not reserve a local test port'))
        return
      }
      server.close((error) => (error ? reject(error) : resolvePort(address.port)))
    })
  })
}

async function waitForSnapshot(url: string, child: ChildProcess, logs: () => string): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Nuxt dev exited before serving the snapshot:\n${logs()}`)
    }
    try {
      const response = await fetch(url)
      if (response.ok) {
        return response
      }
      lastError = new Error(
        `Unexpected status ${response.status}: ${await response.text()}\n${logs()}`,
      )
    } catch (error) {
      lastError = error
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  throw lastError ?? new Error('Nuxt dev server did not start')
}

afterEach(async () => {
  for (const child of children.splice(0)) {
    child.kill('SIGTERM')
    await new Promise<void>((resolveClose) => {
      child.once('close', () => resolveClose())
      setTimeout(resolveClose, 2_000)
    })
  }
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('documented Nuxt dev command', () => {
  it('loads .env and serves the first snapshot request', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toggly-nuxt-sample-'))
    temporaryRoots.push(root)

    // A disposable copy proves the exact README command without touching a
    // developer's real .env file or their working tree.
    await Promise.all([
      cp(join(projectRoot, 'app'), join(root, 'app'), { recursive: true }),
      cp(join(projectRoot, 'lib'), join(root, 'lib'), { recursive: true }),
      cp(join(projectRoot, 'server'), join(root, 'server'), { recursive: true }),
      cp(join(projectRoot, 'nuxt.config.ts'), join(root, 'nuxt.config.ts')),
      cp(join(projectRoot, 'package.json'), join(root, 'package.json')),
      writeFile(
        join(root, '.env'),
        'TOGGLY_APP_KEY=dev-command-proof\nTOGGLY_ENVIRONMENT=Production\n',
      ),
      symlink(join(projectRoot, 'node_modules'), join(root, 'node_modules')),
    ])

    const port = await freePort()
    const environment = { ...process.env }
    delete environment.TOGGLY_APP_KEY
    delete environment.TOGGLY_ENVIRONMENT
    const child = spawn(
      process.execPath,
      [join(projectRoot, 'node_modules', 'nuxt', 'bin', 'nuxt.mjs'), 'dev', '--port', String(port)],
      {
        cwd: root,
        env: environment,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    children.push(child)
    let logs = ''
    child.stdout?.on('data', (chunk) => { logs += String(chunk) })
    child.stderr?.on('data', (chunk) => { logs += String(chunk) })

    const response = await waitForSnapshot(
      `http://localhost:${port}/api/snapshot?preset=matching`,
      child,
      () => logs,
    )
    const snapshot = await response.json() as {
      source: string
      identity: string
      flags: Record<string, boolean>
    }

    expect(snapshot.source).toBe('live')
    expect(snapshot.identity).toBe('alice')
    expect(snapshot.flags).toHaveProperty('new-dashboard')
  }, 30_000)
})
