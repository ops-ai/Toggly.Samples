import { test, expect } from '@playwright/test';
test('entity browser results react to a replacement server snapshot', async ({ page }) => {
  await page.goto('/entity');
  const vipResult = page.getByRole('row').filter({ hasText: 'ord-vip' }).getByRole('cell').nth(3);
  const standardResult = page
    .getByRole('row')
    .filter({ hasText: 'ord-standard' })
    .getByRole('cell')
    .nth(3);
  await expect(vipResult).toHaveText('false');
  let requiredVip = 'true';
  // Replace only the trusted server-load snapshot at the HTTP boundary. This
  // fixture exercises the real provider/evaluator, not signed live transport.
  await page.route('**/entity/__data.json*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const values = body.nodes.find((node: { data?: unknown[] }) => node?.data)?.data;
    const snapshot = values[values[0].toggly];
    const definitions = values[snapshot.definitions];
    // SvelteKit's serialized node stores object values as indexes into this array.
    const index = values.length;
    definitions.ExpressCheckout = index;
    values.push(
      { requirement: index + 1, rules: index + 2 },
      'all',
      [index + 3],
      { property: index + 4, op: index + 5, value: index + 6, type: index + 7 },
      'Vip',
      'eq',
      requiredVip,
      'boolean',
    );
    await route.fulfill({ response, json: body });
  });
  const navigatePreset = async (preset: string) => {
    const link = page.getByRole('link', { name: 'Entity', exact: true });
    await link.evaluate(
      (element, value) => element.setAttribute('href', `/entity?preset=${value}`),
      preset,
    );
    await link.click();
  };
  await navigatePreset('non-matching');
  await expect(vipResult).toHaveText('true');
  await expect(standardResult).toHaveText('false');
  requiredVip = 'false';
  await navigatePreset('matching');
  await expect(vipResult).toHaveText('false');
  await expect(standardResult).toHaveText('true');
});
test('programmatic results react immediately when the local prerequisite changes', async ({
  page,
}) => {
  await page.goto('/programmatic');
  const result = page.locator('main .card');
  await expect(result).toContainText('any: true');
  await page.getByRole('button', { name: 'Toggle device prerequisite' }).click();
  await expect(page.getByText('Device ready: false', { exact: false })).toBeVisible();
  await expect(result).toContainText('Disabled');
  await expect(result).toContainText('any: false');
  await expect(result).toContainText('All: false');
  await expect(result).toContainText('missing default: true');
  await page.getByRole('button', { name: 'Toggle device prerequisite' }).click();
  await expect(result).toContainText('Enabled');
  await expect(result).toContainText('any: true');
  await expect(page).toHaveURL(/\/programmatic$/);
});
test('renders SSR gates, hydrates, navigates context and executes guarded server action', async ({
  page,
  request,
}) => {
  const response = await request.get('/declarative');
  const html = await response.text();
  expect(html).toContain('data-testid="dashboard-on"');
  expect(html).not.toContain('data-testid="dashboard-off"');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/declarative');
  await expect(page.getByTestId('dashboard-on')).toBeVisible();
  await expect(page.getByTestId('dashboard-off')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Offline demonstration');
  await page.getByRole('link', { name: 'Programmatic', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle device prerequisite' }).click();
  await expect(page.getByText('Device ready: false')).toBeVisible();
  await page.getByRole('link', { name: 'Declarative', exact: true }).click();
  await expect(page.getByTestId('dashboard-off')).toBeVisible();
  await expect(page.getByTestId('dashboard-on')).toHaveCount(0);
  await page.getByRole('link', { name: 'Programmatic', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle device prerequisite' }).click();
  await expect(page.getByText('Device ready: true')).toBeVisible();
  await page.getByRole('link', { name: 'Declarative', exact: true }).click();
  await expect(page.getByTestId('dashboard-on')).toBeVisible();
  await expect(page.getByTestId('dashboard-off')).toHaveCount(0);
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
