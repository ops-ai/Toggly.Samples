import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron'
import { gunzipSync } from 'node:zlib'
import { writeFile } from 'node:fs/promises'
import { config as loadEnvironment } from 'dotenv'
import {
  closeToggly,
  attachTogglyLifecycle,
  initToggly,
  registerTogglyIpc,
} from '@ops-ai/electron-feature-flags-toggly/main'
import { preloadEntryPath, rendererEntryPath } from './paths'
import { createOneTimeSetup } from './toggly-lifecycle'

// Load ignored local teaching configuration before reading it. Existing shell or
// CI variables still win; within files, .env.local wins over the shared .env.
loadEnvironment({ path: ['.env.local', '.env'], quiet: true })

const appKey = process.env.TOGGLY_APP_KEY?.trim() ?? ''
const environment = process.env.TOGGLY_ENVIRONMENT?.trim() || 'Production'
const configured = Boolean(appKey && appKey !== 'ci-placeholder')
let disposeIpc: (() => void) | undefined
let disposeLifecycle: (() => void) | undefined
const hostReport = process.env.TOGGLY_SAMPLE_HOST_REPORT
const hostMode = process.env.TOGGLY_SAMPLE_HOST_MODE
const capturedPackets: unknown[] = []

async function setupToggly(): Promise<void> {
  // The SDK and its ipcMain handlers are process-lifetime resources. Set them
  // up once after Electron is ready; macOS activates can reopen windows later.
  // Keeping this separate prevents duplicate ipcMain.handle registrations.
  await initToggly({
    appKey: configured ? appKey : undefined,
    environment,
    userDataPath: app.getPath('userData'),
    flagDefaults: {
      'new-dashboard': false,
      'api-v2': false,
      'enhanced-submit': false,
      ExpressCheckout: false,
      'beta-access': false,
    },
    // A configured desktop app verifies signed definitions before using them.
    // Missing configuration uses local defaults and makes no definitions call.
    verifySignatures: configured,
    enableTelemetry: process.env.TOGGLY_DISABLE_TELEMETRY !== 'true',
    // Native host verification uses a synthetic main-only key and intercepts
    // both transports. It never sends a request to a production endpoint.
    ...(hostReport ? {
      verifySignatures: false,
      enableLiveUpdates: false,
      metricsBaseUrl: 'https://metrics.example.invalid',
      fetch: async () => new Response(null, { status: 403 }),
      telemetryFetch: async (_url: string | URL | Request, options?: RequestInit) => {
        const body = options?.body
        const bytes = body instanceof ArrayBuffer ? Buffer.from(body) : Buffer.from(body as Uint8Array)
        capturedPackets.push(JSON.parse(gunzipSync(bytes).toString('utf8')))
        return new Response('{"ok":1}', { status: 202 })
      },
    } : {}),
    onError: (message, error) => console.warn(`[Toggly Electron sample] ${message}`, error),
  })

  // The SDK installs a narrow, documented IPC surface. It forwards updates to
  // every existing window but exposes no generic ipcRenderer or secret value.
  disposeIpc = registerTogglyIpc(ipcMain, BrowserWindow.getAllWindows)
  disposeLifecycle = attachTogglyLifecycle(app, powerMonitor)
}

const ensureToggly = createOneTimeSetup(setupToggly)

async function createWindow(): Promise<BrowserWindow> {
  // Initialization is deliberately outside this function. This stays safe to
  // call from macOS activate after all windows have been closed.

  const window = new BrowserWindow({
    show: !hostReport,
    width: 1200,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    webPreferences: {
      preload: preloadEntryPath(__dirname),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await window.loadFile(rendererEntryPath(__dirname))
  }

  return window
}

async function runNativeHostContract(window: BrowserWindow): Promise<void> {
  const reportPath = hostReport
  if (!reportPath) return

  try {
    const result = await window.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const deadline = Date.now() + 10_000
        const poll = async () => {
          const bridge = window.toggly
          const feature = document.querySelector('[data-testid="offline-feature"]')
          const negatedFeature = document.querySelector('[data-testid="offline-negated-feature"]')
          const hook = document.querySelector('[data-testid="offline-hook"]')
          if (bridge && negatedFeature && hook) {
            resolve({
              bridge: typeof bridge,
              getFlags: typeof bridge.getFlags,
              defaults: await bridge.getFlags(),
              nodeProcess: typeof window.process,
              feature: Boolean(feature),
              negatedFeature: Boolean(negatedFeature.textContent),
              hookIsDisabled: hook.textContent === 'false',
            })
            return
          }
          if (Date.now() >= deadline) {
            reject(new Error('renderer did not expose the expected Electron bridge and React gates'))
            return
          }
          setTimeout(poll, 25)
        }
        void poll()
      })
    `)
    if (hostMode === 'enabled' || hostMode === 'optout') {
      const telemetry = await window.webContents.executeJavaScript(`
        (() => {
          const direct = window.toggly.isFeatureOn('new-dashboard')
          const gate = window.toggly.evaluateFeatureGate(['api-v2', 'enhanced-submit'], 'any')
          window.toggly.recordUsage('new-dashboard', 'disabled')
          window.toggly.recordView('Cart', 'blue')
          window.toggly.incrementCounter('orders', 2)
          window.toggly.setGauge('cartItems', 3)
          // The published main IPC validator must reject these renderer inputs.
          window.toggly.recordUsage('invalid', 'bad variant')
          window.toggly.incrementCounter('negative', -1)
          return { direct, gate, flush: typeof window.toggly.flushTelemetry }
        })()
      `)
      await window.webContents.executeJavaScript('window.toggly.flushTelemetry()')
      Object.assign(result, { telemetry })
    }
    await writeFile(reportPath, JSON.stringify({ passed: true, ...result, packets: capturedPackets }))
    disposeIpc?.()
    disposeIpc = undefined
    disposeLifecycle?.()
    disposeLifecycle = undefined
    closeToggly()
    app.exit(0)
  } catch (error) {
    await writeFile(reportPath, JSON.stringify({ passed: false, error: String(error) }))
    app.exit(1)
  }
}

app.whenReady().then(async () => {
  if (hostReport && process.env.TOGGLY_SAMPLE_HOST_PID_PATH) {
    await writeFile(process.env.TOGGLY_SAMPLE_HOST_PID_PATH, String(process.pid))
  }
  if (process.env.TOGGLY_SAMPLE_HOST_FAIL === 'true') {
    app.exit(1)
    return
  }
  await ensureToggly()
  const window = await createWindow()
  if (process.env.TOGGLY_SAMPLE_HOST_HANG === 'true') return
  await runNativeHostContract(window)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})

app.on('will-quit', () => {
  // The SDK lifecycle owns the final best-effort flush before quit.
  disposeIpc?.()
  disposeLifecycle?.()
})
