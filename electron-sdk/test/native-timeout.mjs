import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchElectron } from './native-host.mjs'

const sample = dirname(dirname(fileURLToPath(import.meta.url)))
const require = createRequire(join(sample, 'package.json'))
const executable = realpathSync(require('electron'))
const workspace = mkdtempSync(join(tmpdir(), 'toggly-electron-timeout-'))
const reportPath = join(workspace, 'report.json')

try {
  await assert.rejects(
    launchElectron({
      executable, hostDirectory: sample, reportPath, timeoutMs: 2_500,
      environment: {
        ...process.env,
        TOGGLY_APP_KEY: '',
        TOGGLY_SAMPLE_HOST_REPORT: reportPath,
        TOGGLY_SAMPLE_HOST_HANG: 'true',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
    }),
    /Electron host timed out/,
  )
  const pidPath = `${reportPath}.pid`
  assert.ok(existsSync(pidPath), 'real Electron app must write its PID before timeout')
  const pid = Number(readFileSync(pidPath, 'utf8'))
  assert.ok(Number.isSafeInteger(pid) && pid > 0)
  assert.throws(() => process.kill(pid, 0), /ESRCH/, 'owned Electron PID must be absent')
  assert.equal(existsSync(reportPath), false)
  console.log('NATIVE_ELECTRON_TIMEOUT_CLEANUP_PASS')

  const failedReportPath = join(workspace, 'failed.json')
  await assert.rejects(
    launchElectron({
      executable, hostDirectory: sample, reportPath: failedReportPath,
      environment: {
        ...process.env,
        TOGGLY_APP_KEY: '',
        TOGGLY_SAMPLE_HOST_REPORT: failedReportPath,
        TOGGLY_SAMPLE_HOST_FAIL: 'true',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
    }),
    /Electron exited|without a host report/,
  )
  const failedPid = Number(readFileSync(`${failedReportPath}.pid`, 'utf8'))
  assert.throws(() => process.kill(failedPid, 0), /ESRCH/)
  console.log('NATIVE_ELECTRON_FAILURE_CLEANUP_PASS')
} finally {
  rmSync(workspace, { recursive: true, force: true })
}
