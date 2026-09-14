import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const sampleDirectory = dirname(testDirectory)
const tarball = process.env.TOGGLY_ELECTRON_SDK_TARBALL
const workspace = mkdtempSync(join(tmpdir(), 'toggly-electron-sample-packed-hosts-'))
const hosts = [
  { name: 'electron28-retained', electron: '28.3.3' },
  { name: 'electron44-current', electron: '44.3.0' },
]

if (!tarball || !existsSync(tarball)) {
  throw new Error('TOGGLY_ELECTRON_SDK_TARBALL must name the packed 1.0.2 SDK artifact')
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    timeout: 180_000,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})\n${result.stdout}\n${result.stderr}`)
  }
  return result
}

function copySample(destination) {
  cpSync(sampleDirectory, destination, {
    recursive: true,
    filter(source) {
      const name = source.split('/').at(-1)
      return !['node_modules', 'out', 'coverage', '.env', '.env.local'].includes(name)
    },
  })
}

function writeHostManifest(hostDirectory, electronVersion) {
  const manifestPath = join(hostDirectory, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.dependencies['@ops-ai/electron-feature-flags-toggly'] = tarball
  manifest.dependencies.electron = electronVersion
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

function launchElectron(hostDirectory, reportPath) {
  const requireFromHost = createRequire(join(hostDirectory, 'package.json'))
  const executable = realpathSync(requireFromHost('electron'))
  const environment = {
    ...process.env,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    TOGGLY_SAMPLE_HOST_REPORT: reportPath,
  }
  const [command, args] = process.platform === 'darwin'
    ? ['/usr/bin/open', ['-W', '-n', '-g', '--env', 'ELECTRON_DISABLE_SECURITY_WARNINGS=true', '--env', `TOGGLY_SAMPLE_HOST_REPORT=${reportPath}`, dirname(dirname(dirname(executable))), '--args', hostDirectory]]
    : [executable, [hostDirectory, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])]]

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: hostDirectory,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    const timeout = setTimeout(() => child.kill('SIGTERM'), 35_000)
    child.once('error', error => { clearTimeout(timeout); reject(error) })
    child.once('close', exitCode => {
      clearTimeout(timeout)
      if (!existsSync(reportPath)) {
        reject(new Error(`Electron ${exitCode} exited without a host report.\n${output}`))
        return
      }
      resolve(exitCode)
    })
  })
}

try {
  for (const host of hosts.filter(host => !process.env.TOGGLY_ELECTRON_HOST || host.name === process.env.TOGGLY_ELECTRON_HOST)) {
    const hostDirectory = join(workspace, host.name)
    copySample(hostDirectory)
    writeHostManifest(hostDirectory, host.electron)
    run('npm', ['install', '--package-lock=false'], hostDirectory)
    run('npm', ['run', 'build'], hostDirectory)
    const reportPath = join(hostDirectory, 'native-host-report.json')
    const exitCode = await launchElectron(hostDirectory, reportPath)
    const report = JSON.parse(readFileSync(reportPath, 'utf8'))
    assert.equal(exitCode, 0, `Electron ${host.electron} should exit cleanly`)
    assert.deepEqual(report, {
      passed: true,
      bridge: 'object',
      getFlags: 'function',
      defaults: {
        'new-dashboard': false,
        'api-v2': false,
        'enhanced-submit': false,
        ExpressCheckout: false,
        'beta-access': false,
      },
      nodeProcess: 'undefined',
      feature: false,
      negatedFeature: true,
      hookIsDisabled: true,
    })
    console.log(`PACKED_ELECTRON_SAMPLE_${host.electron}_HOST_PASS`)
  }
} finally {
  rmSync(workspace, { recursive: true, force: true })
}
