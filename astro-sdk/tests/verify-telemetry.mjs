import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const key = '00000000-0000-4000-8000-000000000123';
let serverPosts = 0;
const fixture = createServer((request, response) => {
  if (request.method === 'POST') serverPosts++;
  response.writeHead(503, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' });
  response.end('{}');
});
await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
const definitions = `http://127.0.0.1:${fixture.address().port}`;
let browser;

async function runCase(optOut, plain) {
  const env = {
    ...process.env,
    TOGGLY_APP_KEY: key,
    TOGGLY_DEFINITIONS_BASE_URI: definitions,
    TOGGLY_METRICS_BASE_URL: definitions,
    TOGGLY_BROWSER_TELEMETRY: optOut ? 'false' : 'true',
    SAMPLE_OUTPUT: 'server',
  };
  if (!optOut && !plain) {
    execFileSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], {
      cwd: process.cwd(), env, stdio: 'pipe',
    });
    assert.equal(serverPosts, 0, 'configured SSG build must not emit frontend telemetry');
  }
  execFileSync(process.execPath, [process.env.npm_execpath, 'run', 'build:ssr'], {
    cwd: process.cwd(), env, stdio: 'pipe',
  });
  const server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd: process.cwd(),
    env: { ...env, HOST: '127.0.0.1', PORT: '4328' },
    stdio: 'pipe',
  });
  const stopped = once(server, 'exit');
  let context;
  try {
    const origin = 'http://127.0.0.1:4328';
    let home;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        home = await fetch(origin);
        if (home.ok) break;
      } catch { /* wait for startup */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(home?.ok, 'configured SSR host must start');
    assert.match(await home.text(), /Server dashboard enabled/);
    assert.equal(serverPosts, 0, 'trusted SSR clients must not emit frontend telemetry');

    context = await browser.newContext();
    if (plain) {
      await context.addInitScript(() => {
        Object.defineProperty(window, 'CompressionStream', { value: undefined, configurable: true });
      });
    }
    const page = await context.newPage();
    const packets = [];
    await page.route(`${definitions}/api/frontend/telemetry`, async (route) => {
      const request = route.request();
      const encoded = request.postDataBuffer();
      const gzip = request.headers()['content-encoding'] === 'gzip';
      packets.push({
        gzip,
        body: JSON.parse((gzip ? gunzipSync(encoded) : encoded).toString('utf8')),
        keepalive: request.headers()['connection'] !== undefined,
      });
      await route.fulfill({ status: 202, body: '' });
    });
    await page.goto(origin);
    await page.waitForSelector('#react-island');
    await page.waitForSelector('#vue-island');
    await page.waitForSelector('#svelte-island');
    await page.waitForSelector('#react-variant');
    await page.locator('#record-demo-telemetry').click();
    await page.locator('#flush-demo-telemetry').click();
    if (optOut) {
      await page.waitForTimeout(300);
      assert.equal(packets.length, 0, 'browser master opt-out must suppress packets');
      return;
    }
    for (let attempt = 0; packets.length === 0 && attempt < 40; attempt++) {
      await page.waitForTimeout(50);
    }
    assert.ok(packets.length > 0, 'explicit flush sends a real compact packet');
    assert.equal(packets[0].gzip, !plain, 'test exercises requested wire encoding');
    const packet = packets[0].body;
    assert.equal(packet.k, key);
    assert.equal(packet.e, 'Production');
    assert.ok(packet.f?.['new-dashboard'], 'island direct/gate checks and explicit events share one feature row');
    assert.ok(packet.m?.['sample-interactions'], 'explicit counter is present');
    assert.ok(packet.m?.['sample-active-panel'], 'explicit gauge is present');
    const variants = Object.values(packet.f['new-dashboard']);
    assert.ok(variants.some((values) => values[0] > 0 && values[1] > 0 && values[2] > 0),
      'check, usage and view slots must all be present');

    // A fresh queued event is delivered on lifecycle exit without an explicit
    // flush or a second sample-owned reporter.
    await page.evaluate(() => {
      document.querySelector('#record-demo-telemetry').click();
      window.dispatchEvent(new Event('pagehide'));
    });
    for (let attempt = 0; packets.length < 2 && attempt < 40; attempt++) {
      await page.waitForTimeout(50);
    }
    assert.ok(packets.length >= 2, 'pagehide initiates a second packet');
    assert.equal(serverPosts, 0, 'browser requests were intercepted and trusted server remained silent');
    console.log(`Astro browser packet fields: ${Object.keys(packet).sort().join('/')}; encoding: ${plain ? 'plain' : 'gzip'}`);
  } finally {
    try {
      await context?.close();
    } finally {
      server.kill('SIGTERM');
      await stopped;
    }
  }
}

try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
  });
  await runCase(false, false);
  await runCase(false, true);
  await runCase(true, false);
  console.log('Astro public browser telemetry gzip/plain, opt-out, SSR silence and mixed islands passed.');
} finally {
  try {
    await browser?.close();
  } finally {
    await new Promise((resolve) => fixture.close(resolve));
  }
}
