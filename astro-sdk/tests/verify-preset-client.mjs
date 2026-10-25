/**
 * URL preset identity must reach the browser `$flags` store (LiveFlagsIsland).
 * Keeps `data-toggly-state="on|off"` in sync with SSR filter matrix for Live E2E.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { chromium } from '@playwright/test';
import {
  $flags,
  __resetClient,
  initTogglyClient,
  stopRefreshInterval,
  stopWebSocket,
} from '@ops-ai/astro-feature-flags-toggly/client/store';
import { filterCatalog } from '../src/sample/catalog.ts';
import { readLiveSnapshot } from '../src/sample/live-flags.ts';

const root = process.cwd();
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run with npm test.');

const appKey = '00000000-0000-4000-8000-000000000125';
const definitionsPort = 18765;
const definitionsBase = `http://127.0.0.1:${definitionsPort}`;

function variantDefsForIdentity(identity) {
  const targeting = identity === 'alice';
  const defs = {};
  for (const row of filterCatalog) {
    if (row.key === 'filter-targeting') {
      defs[row.key] = { enabled: targeting };
    } else if (row.key === 'filter-always-on' || row.key === 'filter-time-window') {
      defs[row.key] = { enabled: true };
    } else {
      defs[row.key] = { enabled: false };
    }
  }
  defs['new-dashboard'] = { enabled: true };
  defs['api-v2'] = { enabled: false };
  return { defs };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers':
    'content-type, x-toggly-sdk, x-toggly-sdk-version, if-none-match',
};

const signedDefinitions = [
  {
    featureKey: 'filter-targeting',
    filters: [
      {
        name: 'Targeting',
        parameters: { 'Audience.Users:0': 'alice' },
      },
    ],
  },
  {
    featureKey: 'filter-always-on',
    filters: [{ name: 'AlwaysOn', parameters: {} }],
  },
  {
    featureKey: 'filter-time-window',
    filters: [
      {
        name: 'TimeWindow',
        parameters: {
          StartDate: '2020-01-01T00:00:00Z',
          EndDate: '2099-12-31T23:59:59Z',
        },
      },
    ],
  },
  {
    featureKey: 'new-dashboard',
    filters: [{ name: 'AlwaysOn', parameters: {} }],
  },
];

const fixture = createServer((request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }
  const url = new URL(request.url ?? '/', definitionsBase);
  const identity =
    url.searchParams.get('userId') ?? url.searchParams.get('u') ?? '';
  const body = url.pathname.includes('/definitions-signed/')
    ? JSON.stringify(signedDefinitions)
    : JSON.stringify(variantDefsForIdentity(identity));
  response.writeHead(200, {
    ...corsHeaders,
    'Content-Type': 'application/json',
  });
  response.end(body);
});

await new Promise((resolve) => fixture.listen(definitionsPort, '127.0.0.1', resolve));

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const href = String(input);
  if (!href.startsWith(definitionsBase)) {
    return originalFetch(input);
  }
  const url = new URL(href);
  const identity =
    url.searchParams.get('userId') ?? url.searchParams.get('u') ?? '';
  const payload = url.pathname.includes('/definitions-signed/')
    ? signedDefinitions
    : variantDefsForIdentity(identity);
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

const baseConfig = {
  appKey,
  environment: 'Production',
  baseURI: definitionsBase,
  verifySignatures: false,
  enableLiveUpdates: false,
  enableVariants: true,
  featureFlagsRefreshInterval: 0,
  flagDefaults: {
    'filter-targeting': false,
    'filter-always-on': true,
    'new-dashboard': true,
    'api-v2': false,
  },
};

try {
  __resetClient();
  await initTogglyClient(baseConfig);
  assert.equal(
    readLiveSnapshot($flags.get())['filter-targeting'],
    false,
    'client without identity must not match alice targeting',
  );

  await initTogglyClient({
    ...baseConfig,
    identity: 'alice',
    claims: { role: 'admin' },
  });
  assert.equal(
    readLiveSnapshot($flags.get())['filter-targeting'],
    true,
    'preset=matching must enable filter-targeting in the client store',
  );

  await initTogglyClient({
    ...baseConfig,
    identity: 'bob',
    claims: { role: 'user' },
  });
  assert.equal(
    readLiveSnapshot($flags.get())['filter-targeting'],
    false,
    'preset=nonmatching must keep filter-targeting off in the client store',
  );
} finally {
  stopRefreshInterval();
  stopWebSocket();
  __resetClient();
  globalThis.fetch = originalFetch;
}

const run = (args, extra = {}) =>
  execFileSync(process.execPath, [npm, ...args], {
    cwd: root,
    env: {
      ...process.env,
      TOGGLY_APP_KEY: appKey,
      TOGGLY_DEFINITIONS_BASE_URI: definitionsBase,
      TOGGLY_METRICS_BASE_URL: definitionsBase,
      TOGGLY_BROWSER_TELEMETRY: 'false',
      TOGGLY_VERIFY_SIGNATURES: 'false',
      ...extra,
    },
    stdio: 'inherit',
  });

run(['run', 'build:ssr'], { SAMPLE_OUTPUT: 'server' });

const port = 4329;
const server = spawn(process.execPath, ['dist/server/entry.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    TOGGLY_APP_KEY: appKey,
    TOGGLY_DEFINITIONS_BASE_URI: definitionsBase,
    TOGGLY_METRICS_BASE_URL: definitionsBase,
    TOGGLY_BROWSER_TELEMETRY: 'false',
    TOGGLY_VERIFY_SIGNATURES: 'false',
  },
  stdio: 'inherit',
});
const stopped = once(server, 'exit');
if (server.exitCode !== null || server.signalCode !== null) {
  throw new Error('SSR server failed to start');
}

const origin = `http://127.0.0.1:${port}`;
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const probe = await fetch(origin);
      if (probe.ok) break;
    } catch {
      /* wait */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
      : {}),
  });
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      let configuration;
      Object.defineProperty(window, '__TOGGLY_CONFIG__', {
        configurable: true,
        get() {
          return configuration;
        },
        set(value) {
          configuration = {
            ...value,
            verifySignatures: false,
            enableLiveUpdates: false,
          };
        },
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (message) => errors.push(String(message)));
    await page.goto(`${origin}/?preset=matching`, {
      headers: { cookie: 'sample-preset=matching' },
    });
    await page.waitForSelector('#filter-matrix');
    const ssrTargeting = page.locator(
      'tr[data-filter="filter-targeting"] [data-toggly-state]',
    );
    assert.equal(
      await ssrTargeting.getAttribute('data-toggly-state'),
      'on',
      'SSR filter matrix must show filter-targeting ON for harness URL/cookie',
    );
    await page.waitForSelector('#live-filter-checklist');
    await page.waitForFunction(
      () =>
        document
          .querySelector(
            '[data-live-filter="filter-targeting"] [data-toggly-state]',
          )
          ?.getAttribute('data-toggly-state') === 'on',
      undefined,
      { timeout: 15_000 },
    );
    const targeting = page.locator(
      '[data-live-filter="filter-targeting"] [data-toggly-state]',
    );
    assert.equal(
      await targeting.getAttribute('data-toggly-state'),
      'on',
      'client filter checklist must expose data-toggly-state=on for alice preset',
    );

    assert.deepEqual(errors, [], 'preset client island must hydrate without errors');

    const harnessContext = await browser.newContext({
      extraHTTPHeaders: { 'x-demo-preset': 'matching' },
    });
    await harnessContext.addCookies([
      { name: 'sample-preset', value: 'matching', url: origin },
    ]);
    const harnessPage = await harnessContext.newPage();
    await harnessPage.goto(`${origin}/`);
    await harnessPage.waitForSelector('#filter-matrix');
    assert.equal(
      await harnessPage
        .locator('tr[data-filter="filter-targeting"] [data-toggly-state]')
        .getAttribute('data-toggly-state'),
      'on',
      'harness fingerprint (no ?preset=) must SSR filter-targeting ON',
    );
    await harnessContext.close();

    await page.goto(`${origin}/?preset=nonmatching`);
    await page.waitForSelector('#live-filter-checklist');
    await page.waitForFunction(
      () =>
        document
          .querySelector(
            '[data-live-filter="filter-targeting"] [data-toggly-state]',
          )
          ?.getAttribute('data-toggly-state') === 'off',
      undefined,
      { timeout: 15_000 },
    );

    await context.close();
  } finally {
    await browser.close();
  }
} finally {
  server.kill('SIGTERM');
  await stopped;
  fixture.close();
}

console.log(
  'Astro preset client identity tests passed (store sync + data-toggly-state).',
);
