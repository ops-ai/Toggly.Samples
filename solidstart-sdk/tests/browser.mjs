import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  importDevelopmentToolbar,
  runWithCleanup,
  stopOwnedProcess,
} from './browser-lifecycle.mjs';

assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--dev'));
const development = process.argv.includes('--dev');

// Cold dependency optimization makes the lazy development toolbar regression reproducible.
const serverArguments = development
  ? [
      'node_modules/vite/bin/vite.js',
      '--host',
      '127.0.0.1',
      '--port',
      '5198',
      '--strictPort',
      '--force',
    ]
  : ['.output/server/index.mjs'];
const server = spawn(process.execPath, serverArguments, {
  env: {
    ...process.env,
    PORT: '5198',
    HOST: '127.0.0.1',
    TOGGLY_BACKEND_APP_KEY: '',
    VITE_TOGGLY_APP_KEY: '',
  },
  stdio: 'inherit',
});
let browser;
let browserServer;
await runWithCleanup(
  async () => {
    let ready = false;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (server.exitCode !== null || server.signalCode !== null) {
        throw new Error(
          `Sample server exited before readiness: ${server.exitCode ?? server.signalCode}`,
        );
      }
      try {
        if ((await fetch('http://127.0.0.1:5198', { signal: AbortSignal.timeout(1000) })).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, 'Sample server did not become ready within 15 seconds');
    // Retain the public process handle so a stalled browser.close() cannot strand CI.
    browserServer = await chromium.launchServer({ headless: true, timeout: 30_000 });
    browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 30_000 });
    const page = await browser.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:5198');
    if (development) {
      // Await the real lazy toolbar graph: rendered SSR headings alone cannot
      // prove that its browser-only CommonJS dependency imported successfully.
      assert.equal(await importDevelopmentToolbar(page), 'function');
      await page.locator('[tc-toolbar]').waitFor();
    }
    for (const name of [
      'Home',
      'Declarative gates',
      'Programmatic API',
      'Identity',
      'Entity context',
      'Filters matrix',
      'SolidStart boundaries',
      'Configuration',
    ])
      await page.getByRole('heading', { name, exact: true }).waitFor();
    await page.getByText('Missing frontend app key.', { exact: false }).waitFor();
    await page.getByText('Missing backend app key.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Run server action' }).click();
    await page.getByText('Server guard returned 404.', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Non-matching', exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector('#section-3 pre')?.textContent.includes('bob'),
    );
    await page.getByRole('link', { name: 'Matching', exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector('#section-3 pre')?.textContent.includes('alice'),
    );
    await page.getByLabel('Order.Vip').uncheck();
    await page.getByText('Standard checkout', { exact: true }).waitFor();
    assert.equal(await page.locator('#section-5 tbody tr').count(), 11);
    await page.getByRole('link', { name: 'Leave workshop to dispose provider' }).click();
    await page.getByRole('heading', { name: 'Provider disposed' }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      'PASS sample eight sections, missing keys, guard, navigation, entity control, filter matrix and disposal navigation',
    );
  },
  async () => {
    console.log('Closing test-owned browser and sample server');
    const results = await Promise.allSettled([
      browserServer &&
        stopOwnedProcess(browserServer.process(), 'Browser', {
          close: async () => {
            await browser?.close();
            await browserServer.close();
          },
          kill: () => browserServer.kill(),
        }),
      stopOwnedProcess(server, 'Sample server'),
    ]);
    const failures = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason);
    if (failures.length) throw new AggregateError(failures, 'Test resource cleanup failed');
    console.log('Test-owned browser and sample server closed');
  },
);
