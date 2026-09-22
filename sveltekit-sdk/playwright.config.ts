import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://127.0.0.1:4184' },
  webServer: [
    {
      command:
        "ORIGIN=http://127.0.0.1:4183 HOST=127.0.0.1 PORT=4183 TOGGLY_APP_KEY='' TOGGLY_ENVIRONMENT=Production PUBLIC_TOGGLY_APP_KEY=sveltekit-browser-test-key PUBLIC_TOGGLY_ENVIRONMENT=Production PUBLIC_TOGGLY_ENABLE_TELEMETRY=true npm start",
      url: 'http://127.0.0.1:4183',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command:
        "ORIGIN=http://127.0.0.1:4184 HOST=127.0.0.1 PORT=4184 TOGGLY_APP_KEY='' TOGGLY_ENVIRONMENT=Production PUBLIC_TOGGLY_APP_KEY='' PUBLIC_TOGGLY_ENVIRONMENT=Production PUBLIC_TOGGLY_ENABLE_TELEMETRY=true npm start",
      url: 'http://127.0.0.1:4184',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command:
        "ORIGIN=http://127.0.0.1:4185 HOST=127.0.0.1 PORT=4185 TOGGLY_APP_KEY='' TOGGLY_ENVIRONMENT=Production PUBLIC_TOGGLY_APP_KEY=sveltekit-optout-test-key PUBLIC_TOGGLY_ENVIRONMENT=Production PUBLIC_TOGGLY_ENABLE_TELEMETRY=false npm start",
      url: 'http://127.0.0.1:4185',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
