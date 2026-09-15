import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = process.cwd();
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run with npm test.');

const run = (args, extra = {}) =>
  execFileSync(process.execPath, [npm, ...args], {
    cwd: root,
    env: {
      ...process.env,
      TOGGLY_APP_KEY: '',
      TOGGLY_ENVIRONMENT: 'Production',
      ...extra,
    },
    stdio: 'inherit',
  });

run(['run', 'check']);
run(['run', 'build']);

const manifest = JSON.parse(
  readFileSync(join(root, 'dist/toggly-page-features.json'), 'utf8'),
);
assert.equal(manifest['/beta'], 'beta-access');
assert.ok(
  existsSync(join(root, 'dist/index.html')),
  'static build must produce the home page',
);

const homeHtml = readFileSync(join(root, 'dist/index.html'), 'utf8');
assert.match(homeHtml, /id="missing-app-key"/);
assert.match(homeHtml, /Server dashboard enabled/);
assert.match(homeHtml, /id="section-gates"/);
assert.match(homeHtml, /id="section-programmatic"/);
assert.match(homeHtml, /id="section-identity"/);
assert.match(homeHtml, /id="section-order"/);
assert.match(homeHtml, /id="section-filters"/);
assert.match(homeHtml, /id="section-unique"/);
assert.match(homeHtml, /id="filter-matrix"/);
assert.match(homeHtml, /id="live-snapshot"/);

run(['run', 'build:ssr']);

const port = 4327;

async function withServer(betaAccessDefault, verify) {
  const server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      TOGGLY_APP_KEY: '',
      ...(betaAccessDefault === undefined
        ? {}
        : { TOGGLY_BETA_ACCESS_DEFAULT: betaAccessDefault }),
    },
    stdio: 'inherit',
  });
  if (server.exitCode !== null || server.signalCode !== null) return;
  const stopped = once(server, 'exit');
  const origin = `http://127.0.0.1:${port}`;
  try {
    let home;
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        home = await fetch(origin);
        if (home.ok) break;
      } catch {
        /* wait for server */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(home?.ok, 'SSR server must become available');
    await verify(origin, home);
  } finally {
    server.kill('SIGTERM');
    await stopped;
  }
}

await withServer(undefined, async (origin, home) => {
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-toggly-middleware'), 'applied');
  const html = await home.text();
  assert.match(html, /Server dashboard enabled/);
  assert.match(html, /id="variant-outcome"/);
  assert.match(html, /id="filter-identity"/);
  assert.match(html, /id="filter-vip"/);
  assert.match(html, /id="express-vip"/);
  assert.equal((await fetch(`${origin}/beta/`)).status, 200);

  const matching = await fetch(`${origin}/?preset=matching`);
  assert.equal(matching.status, 200);
  assert.equal(matching.headers.get('x-toggly-identity'), 'alice');

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
      : {}),
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin);
    await page.waitForSelector('#react-island');
    await page.waitForSelector('#vue-island');
    await page.waitForSelector('#svelte-island');
    assert.deepEqual(errors, [], 'islands must hydrate without browser exceptions');
  } finally {
    await browser.close();
  }
});

await withServer('false', async (origin) => {
  const beta = await fetch(`${origin}/beta/`);
  assert.equal(beta.status, 404, 'beta page gate must deny the false default');
  assert.match(await beta.text(), /Beta access is disabled/);
});

console.log(
  'Astro SSG, SSR middleware/page gate deny+allow, and React/Vue/Svelte browser islands passed.',
);
