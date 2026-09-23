import { defineConfig } from '@playwright/test'

const modes = ['enabled', 'opt-out', 'no-key'] as const
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 45_000,
  use: { launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {} },
  projects: modes.map((name, index) => ({ name, use: { baseURL: `http://127.0.0.1:${4195 + index}` } })),
  webServer: modes.map((mode, index) => ({
    command: `npm run dev -- --host 127.0.0.1 --port ${4195 + index} --strictPort`,
    url: `http://127.0.0.1:${4195 + index}`,
    reuseExistingServer: false,
    env: {
      VITE_TOGGLY_APP_KEY: mode === 'no-key' ? '' : 'telemetry-test-only',
      VITE_TOGGLY_ENVIRONMENT: 'Production',
      VITE_TOGGLY_ENABLE_TELEMETRY: mode === 'opt-out' ? 'false' : 'true',
      VITE_TOGGLY_METRICS_BASE_URL: 'https://metrics.test.invalid',
    },
  })),
})
