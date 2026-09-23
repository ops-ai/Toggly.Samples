import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchElectron } from './native-host.mjs'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const sampleDirectory = dirname(testDirectory)
const tarball = process.env.TOGGLY_ELECTRON_SDK_TARBALL
const workspace = mkdtempSync(join(tmpdir(), 'toggly-electron-sample-packed-hosts-'))
const hosts = [
  { name: 'electron28-retained', electron: '28.3.3' },
  { name: 'electron44-current', electron: '44.3.0' },
]

if (!tarball || !existsSync(tarball)) {
  throw new Error('TOGGLY_ELECTRON_SDK_TARBALL must name the packed 1.1.0 SDK artifact')
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

try {
  for (const host of hosts.filter(host => !process.env.TOGGLY_ELECTRON_HOST || host.name === process.env.TOGGLY_ELECTRON_HOST)) {
    const hostDirectory = join(workspace, host.name)
    copySample(hostDirectory)
    writeHostManifest(hostDirectory, host.electron)
    run('npm', ['install', '--package-lock=false'], hostDirectory)
    run('npm', ['run', 'build'], hostDirectory)
    const reportPath = join(hostDirectory, 'native-host-report.json')
    const requireFromHost = createRequire(join(hostDirectory, 'package.json'))
    const executable = realpathSync(requireFromHost('electron'))
    const exitCode = await launchElectron({
      executable, hostDirectory, reportPath,
      environment: {
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
        TOGGLY_SAMPLE_HOST_REPORT: reportPath,
      },
    })
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
      packets: [],
    })
    console.log(`PACKED_ELECTRON_SAMPLE_${host.electron}_HOST_PASS`)
  }
} finally {
  rmSync(workspace, { recursive: true, force: true })
}
