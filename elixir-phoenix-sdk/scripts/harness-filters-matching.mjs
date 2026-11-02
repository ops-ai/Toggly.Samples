/**
 * Live E2E filters-matching parity: anonymous URL, harness preset via header + cookie,
 * and ADO filter-cookie fingerprint (no sample-preset / x-demo-preset).
 */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const origin = process.env.SAMPLE_URL || 'http://127.0.0.1:4000';
const base = new URL(origin);

const matchingUa =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function assertMatchingTargeting(context, label) {
  const page = await context.newPage();
  await page.goto(base.href);
  await page.locator('[data-phx-main].phx-connected').waitFor({ timeout: 60_000 });
  await page.waitForFunction(
    () =>
      document.querySelector('#filter-targeting [data-toggly-state]')?.getAttribute('data-toggly-state') ===
      'on',
    undefined,
    { timeout: 60_000 },
  );
  assert.equal((await page.locator('#current-identity').innerText()).trim(), 'alice', label);
  assert.equal((await page.locator('#filter-targeting').innerText()).trim(), 'ON');
  await page.close();
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
});

try {
  const legacy = await browser.newContext({
    extraHTTPHeaders: { 'x-demo-preset': 'matching' },
  });
  await legacy.addCookies([
    {
      name: 'sample-preset',
      value: 'matching',
      url: `${base.origin}/`,
    },
  ]);
  await assertMatchingTargeting(legacy, 'legacy harness headers');
  await legacy.close();

  const ado = await browser.newContext();
  await ado.addCookies([
    { name: 'toggly-identity', value: 'alice', url: `${base.origin}/` },
    { name: 'toggly-filter-claims', value: 'admin', url: `${base.origin}/` },
    { name: 'toggly-filter-country', value: 'US', url: `${base.origin}/` },
    { name: 'toggly-filter-lang', value: encodeURIComponent('en-US,en;q=0.9'), url: `${base.origin}/` },
    { name: 'toggly-filter-ua', value: matchingUa, url: `${base.origin}/` },
    { name: 'toggly-filter-vip', value: '1', url: `${base.origin}/` },
  ]);
  await assertMatchingTargeting(ado, 'ADO filter cookies');
  await ado.close();
} finally {
  await browser.close();
}

console.log('Elixir harness filters-matching preset parity passed.');
