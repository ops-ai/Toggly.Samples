import { app, BrowserWindow, ipcMain } from 'electron'
import { config as loadEnvironment } from 'dotenv'
import {
  closeToggly,
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
    onError: (message, error) => console.warn(`[Toggly Electron sample] ${message}`, error),
  })

  // The SDK installs a narrow, documented IPC surface. It forwards updates to
  // every existing window but exposes no generic ipcRenderer or secret value.
  disposeIpc = registerTogglyIpc(ipcMain, BrowserWindow.getAllWindows)
}

const ensureToggly = createOneTimeSetup(setupToggly)

async function createWindow(): Promise<void> {
  // Initialization is deliberately outside this function. This stays safe to
  // call from macOS activate after all windows have been closed.

  const window = new BrowserWindow({
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
}

app.whenReady().then(async () => {
  await ensureToggly()
  await createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})

app.on('before-quit', () => {
  // Stop the refresh timer/WebSocket and unregister handlers during shutdown.
  disposeIpc?.()
  closeToggly()
})
