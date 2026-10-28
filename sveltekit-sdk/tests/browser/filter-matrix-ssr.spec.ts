import { test, expect } from '@playwright/test';

test('filters SSR snapshot shows filter-targeting ON for matching preset (keyless)', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/filters?preset=matching');
  const cell = page.locator('tr[data-filter="filter-targeting"]').locator('[data-toggly-state]');
  await expect(cell).toHaveAttribute('data-toggly-state', 'on');
  await expect(cell).toHaveText('ON');
  await context.close();
});
