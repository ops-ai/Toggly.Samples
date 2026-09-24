import { defineConfig } from '@playwright/test'

const noKey = process.env.TELEMETRY_TEST_NO_KEY === '1'
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:3195',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3195',
    url: 'http://127.0.0.1:3195',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      TOGGLY_APP_KEY: '',
      NEXT_PUBLIC_TOGGLY_APP_KEY: noKey ? '' : 'telemetry-test-only',
      NEXT_PUBLIC_TOGGLY_METRICS_BASE_URL: 'https://metrics.test.invalid',
      NEXT_PUBLIC_TOGGLY_ENABLE_TELEMETRY: 'true',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
})
