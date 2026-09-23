import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import {
  importDevelopmentToolbar,
  runWithCleanup,
  stopOwnedProcess,
} from './browser-lifecycle.mjs';

assert.ok(
  process.argv.length === 2 ||
    (process.argv.length === 3 &&
      ['--dev', '--no-telemetry', '--keyless'].includes(process.argv[2])),
);
const development = process.argv.includes('--dev');
const telemetryDisabled =
  process.argv.includes('--no-telemetry') || process.argv.includes('--keyless');
const keyless = process.argv.includes('--keyless');

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
    VITE_TOGGLY_APP_KEY: keyless ? '' : 'solidstart-browser-test-key',
    VITE_TOGGLY_BASE_URL: 'http://127.0.0.1:5198/definitions',
    VITE_TOGGLY_METRICS_BASE_URL: 'http://127.0.0.1:5198/metrics',
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
    browserServer = await chromium.launchServer({
      headless: true,
      timeout: 30_000,
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    });
    browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 30_000 });
    const page = await browser.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const telemetryPackets = [];
    await page.route('**/definitions/**', (route) =>
      route.fulfill({ status: 404, body: 'Definition service disabled in browser fixture' }),
    );
    await page.route('**/metrics/api/frontend/telemetry', async (route) => {
      const request = route.request();
      assert.equal(request.method(), 'POST');
      const headers = request.headers();
      assert.equal(headers['content-type'], 'application/json');
      assert.equal(headers.cookie, undefined);
      assert.equal(headers.authorization, undefined);
      const bytes = request.postDataBuffer();
      assert.ok(bytes);
      const text =
        headers['content-encoding'] === 'gzip'
          ? gunzipSync(bytes).toString('utf8')
          : bytes.toString('utf8');
      telemetryPackets.push({ envelope: JSON.parse(text), headers });
      await route.fulfill({ status: 202 });
    });
    const waitForPacket = async (matches, description) => {
      const deadline = Date.now() + 5000;
      while (!telemetryPackets.some(matches) && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 25));
      const packet = telemetryPackets.find(matches);
      assert.ok(packet, `Expected ${description} telemetry packet`);
      return packet.envelope;
    };
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
    await page.getByText('Missing backend app key.', { exact: false }).waitFor();
    if (keyless) await page.getByText('Missing frontend app key.', { exact: false }).waitFor();
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
    await page.getByLabel('Device ready (browser-local enhanced-submit gate)').uncheck();
    await page.getByText('Local or remote submit gate is closed.', { exact: true }).waitFor();
    assert.equal(await page.locator('#section-5 tbody tr').count(), 11);
    if (telemetryDisabled) {
      for (const name of [
        'Record usage',
        'Record view',
        'Add orders',
        'Set active carts',
        'Flush telemetry',
      ])
        await page.getByRole('button', { name }).click();
      await page.waitForTimeout(100);
      assert.equal(telemetryPackets.length, 0);
      assert.deepEqual(errors, []);
      console.log(
        `PASS SolidStart browser ${keyless ? 'keyless' : 'telemetry opt-out'} sends no telemetry`,
      );
      return;
    }
    await page.getByRole('button', { name: 'Flush telemetry' }).click();
    const baseline = await waitForPacket(
      ({ envelope }) => Object.keys(envelope.f ?? {}).length > 0,
      'feature check',
    );
    assert.equal(baseline.k, 'solidstart-browser-test-key');
    assert.equal(baseline.e, 'Production');
    assert.ok(Object.keys(baseline.f ?? {}).length > 0);
    assert.ok(Object.keys(baseline).every((key) => ['k', 'e', 'f', 'm', 'i', 'u'].includes(key)));

    await page.getByRole('button', { name: 'Record usage' }).click();
    await page.getByRole('button', { name: 'Record view' }).click();
    await page.getByRole('button', { name: 'Add orders' }).click();
    await page.getByRole('button', { name: 'Set active carts' }).click();
    await page.getByRole('button', { name: 'Flush telemetry' }).click();
    const explicit = await waitForPacket(
      ({ envelope }) => envelope.m?.orders === 2 && envelope.m?.['active-carts'] === 3,
      'explicit API',
    );
    assert.deepEqual(explicit.f?.['new-dashboard']?.['sample-control'], [0, 1]);
    assert.equal(explicit.f?.['new-dashboard']?.enabled?.[2], 1);
    assert.equal(
      Object.values(explicit.f ?? {})
        .flatMap(Object.values)
        .reduce((total, values) => total + (values[0] ?? 0), 0),
      0,
    );
    assert.equal(explicit.m?.orders, 2);
    assert.equal(explicit.m?.['active-carts'], 3);
    for (const forbidden of ['groups', 'claims', 'entity', 'timestamp', 'instanceName'])
      assert.equal(Object.hasOwn(explicit, forbidden), false);
    console.log(
      `Observed SolidStart telemetry packet fields: ${Object.keys(explicit).sort().join(',')}`,
    );

    await page.getByRole('button', { name: 'Record view' }).click();
    const beforeDisposal = telemetryPackets.length;
    await page.getByRole('link', { name: 'Leave workshop to dispose provider' }).click();
    await page.getByRole('heading', { name: 'Provider disposed' }).waitFor();
    await waitForPacket((_, index) => index >= beforeDisposal, 'provider cleanup');
    assert.deepEqual(errors, []);
    console.log(
      'PASS sample browser gates, local/entity context, telemetry APIs/packet, owner disposal and server guard',
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
