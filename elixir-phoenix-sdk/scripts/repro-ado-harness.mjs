/**
 * Reproduce LiveE2E filters-matching against a running showcase (port 4000).
 * Scenarios: ADO filter cookies only, legacy x-demo-preset + sample-preset, header identity.
 */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const origin = process.env.SAMPLE_URL || 'http://127.0.0.1:4000';
const base = new URL(origin);
const pageUrl = `${base.origin}/`;

/** Playwright rejects raw commas in cookie values; ADO stores encoded values. */
const cookieUrl = pageUrl;

const matchingUa =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Cookie set observed on ADO run 9463 (preset=none fingerprint=matching). */
const adoFilterCookies = [
  { name: 'toggly-identity', value: 'alice', url: cookieUrl },
  { name: 'toggly-filter-claims', value: 'admin', url: cookieUrl },
  { name: 'toggly-filter-country', value: 'US', url: cookieUrl },
  {
    name: 'toggly-filter-lang',
    value: encodeURIComponent('en-US,en;q=0.9'),
    url: cookieUrl,
  },
  { name: 'toggly-filter-ua', value: matchingUa, url: cookieUrl },
  { name: 'toggly-filter-vip', value: '1', url: cookieUrl },
];

async function readTargetingState(page) {
  const dead = await page
    .locator('#filter-targeting [data-toggly-state]')
    .first()
    .getAttribute('data-toggly-state');
  const connected = await page.evaluate(() =>
    document.querySelector('[data-phx-main]')?.classList.contains('phx-connected'),
  );
  const identity = (await page.locator('#current-identity').innerText()).trim();
  return { dead, connected, identity, rowText: (await page.locator('#filter-targeting').innerText()).trim() };
}

async function scenario(name, setup) {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
  });
  try {
    const context = await browser.newContext();
    await setup(context);
    const page = await context.newPage();
    await page.goto(`${base.origin}/`);
    const beforeConnect = await readTargetingState(page);
    await page.locator('[data-phx-main].phx-connected').waitFor({ timeout: 60_000 });
    const afterConnect = await readTargetingState(page);
    console.log(JSON.stringify({ scenario: name, beforeConnect, afterConnect }, null, 2));
    assert.equal(afterConnect.dead, 'on', `${name}: filter-targeting must be ON after connect`);
    assert.equal(afterConnect.identity, 'alice', `${name}: identity must be alice`);
    await context.close();
  } finally {
    await browser.close();
  }
}

await scenario('ado-filter-cookies-only', async (context) => {
  await context.addCookies(adoFilterCookies);
});

await scenario('legacy-harness-header-and-sample-preset', async (context) => {
  await context.setExtraHTTPHeaders({ 'x-demo-preset': 'matching', 'x-toggly-identity': 'alice' });
  await context.addCookies([{ name: 'sample-preset', value: 'matching', url: base.origin }]);
});

await scenario('header-identity-only-preset-none', async (context) => {
  await context.setExtraHTTPHeaders({ 'x-toggly-identity': 'alice' });
});

console.log('Elixir harness repro scenarios passed.');
