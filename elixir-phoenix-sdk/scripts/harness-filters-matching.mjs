/**
 * Live E2E filters-matching parity: anonymous URL, harness preset via header + cookie.
 */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const origin = process.env.SAMPLE_URL || 'http://127.0.0.1:4000';
const base = new URL(origin);

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
    : {}),
});

try {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-demo-preset': 'matching' },
  });
  await context.addCookies([
    {
      name: 'sample-preset',
      value: 'matching',
      url: base.origin,
    },
  ]);
  const page = await context.newPage();
  await page.goto(base.href);
  await page.locator('[data-phx-main].phx-connected').waitFor({ timeout: 60_000 });
  await page.waitForFunction(
    () => document.querySelector('#filter-targeting [data-toggly-state]')?.getAttribute('data-toggly-state') === 'on',
    undefined,
    { timeout: 60_000 },
  );
  assert.equal(
    (await page.locator('#current-identity').innerText()).trim(),
    'alice',
    'harness preset must resolve alice before targeting evaluation',
  );
  assert.equal((await page.locator('#filter-targeting').innerText()).trim(), 'ON');
  await context.close();
} finally {
  await browser.close();
}

console.log('Elixir harness filters-matching preset parity passed.');
