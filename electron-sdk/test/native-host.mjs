import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function alive(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

async function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (alive(pid) && Date.now() < deadline) await delay(50)
  return !alive(pid)
}

async function stopPid(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0 || !alive(pid)) return
  try { process.kill(pid, 'SIGTERM') } catch { return }
  if (await waitForExit(pid, 2_000)) return
  try { process.kill(pid, 'SIGKILL') } catch { return }
  if (!await waitForExit(pid, 2_000)) throw new Error(`Owned Electron PID ${pid} survived SIGKILL`)
}

/** Launch a real Electron app and own its PID even when macOS uses open -W. */
export async function launchElectron({ executable, hostDirectory, reportPath, environment, timeoutMs = 35_000 }) {
  const pidPath = `${reportPath}.pid`
  const env = { ...environment, TOGGLY_SAMPLE_HOST_PID_PATH: pidPath }
  const [command, args] = process.platform === 'darwin'
    ? ['/usr/bin/open', [
      '-W', '-n', '-g',
      ...Object.entries(env)
        .filter(([key]) => key.startsWith('TOGGLY_') || key === 'ELECTRON_DISABLE_SECURITY_WARNINGS')
        .flatMap(([key, value]) => ['--env', `${key}=${value}`]),
      dirname(dirname(dirname(executable))), '--args', hostDirectory,
    ]]
    : [executable, [hostDirectory, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])]]

  const child = spawn(command, args, { cwd: hostDirectory, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  let launcherClosed = false
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => {
      launcherClosed = true
      resolve({ code, signal })
    })
  })
  let timer
  let failed = false
  try {
    const outcome = await Promise.race([
      closed,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Electron host timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
    if (outcome.code !== 0) throw new Error(`Electron exited ${outcome.code ?? outcome.signal}\n${output}`)
    if (!existsSync(reportPath)) throw new Error(`Electron exited without a host report\n${output}`)
    if (existsSync(pidPath) && alive(Number(readFileSync(pidPath, 'utf8')))) {
      throw new Error('Electron launcher exited while its owned app remained alive')
    }
    return outcome.code
  } catch (error) {
    failed = true
    throw error
  } finally {
    clearTimeout(timer)
    // Do not erase reports until the owned app is gone. Killing open alone
    // leaves the macOS Electron process and its BrowserWindow running.
    if (existsSync(pidPath)) {
      const pid = Number(readFileSync(pidPath, 'utf8'))
      await stopPid(pid)
    }
    if (!launcherClosed) {
      child.kill('SIGTERM')
      await Promise.race([closed, delay(2_000)])
      if (!launcherClosed) {
        child.kill('SIGKILL')
        await Promise.race([closed, delay(2_000)])
      }
      if (!launcherClosed) throw new Error('Electron launcher survived SIGKILL')
    }
    if (failed && !existsSync(pidPath)) {
      // Launch Services can hand off the app just as the launcher is stopped.
      const latePidDeadline = Date.now() + 1_000
      while (!existsSync(pidPath) && Date.now() < latePidDeadline) await delay(50)
      if (existsSync(pidPath)) await stopPid(Number(readFileSync(pidPath, 'utf8')))
    }
    if (failed && existsSync(pidPath)) {
      const pid = Number(readFileSync(pidPath, 'utf8'))
      if (alive(pid)) throw new Error(`Owned Electron PID ${pid} survived cleanup`)
    }
  }
}
