import { test, expect } from '@playwright/test';
test('renders SSR gates, hydrates, navigates context and executes guarded server action', async ({
  page,
  request,
}) => {
  const response = await request.get('/declarative');
  expect(await response.text()).toContain('dashboard-on');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/declarative');
  await expect(page.getByTestId('dashboard-on')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Offline demonstration');
  await page.getByRole('link', { name: 'Programmatic', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle device prerequisite' }).click();
  await expect(page.getByText('Device ready: false')).toBeVisible();
  await page.getByRole('button', { name: 'Toggle device prerequisite' }).click();
  await expect(page.getByText('Device ready: true')).toBeVisible();
  await page.getByRole('link', { name: 'Identity', exact: true }).click();
  await page.getByRole('button', { name: 'Non-matching · bob' }).click();
  await expect(page.locator('pre')).toContainText('bob');
  await page.getByRole('link', { name: 'Filters', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'filter-targeting' })).toContainText('OFF');
  await page.getByRole('button', { name: 'Matching preset', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'filter-targeting' })).toContainText('ON');
  await page.getByRole('link', { name: 'Entity', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'ord-vip' })).toContainText('true');
  await page.getByRole('link', { name: 'Framework', exact: true }).click();
  await page.getByRole('button', { name: 'Submit enhanced action' }).click();
  await expect(
    page.getByText('The enhanced-submit server gate allowed this action.'),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('concurrent SSR requests preserve independent matching and nonmatching filters', async ({
  request,
}) => {
  const [a, b] = await Promise.all([
    request.get('/filters?preset=matching'),
    request.get('/filters?preset=non-matching'),
  ]);
  expect(await a.text()).toContain('identity:"alice"');
  expect(await b.text()).toContain('identity:"bob"');
});
