import assert from 'node:assert/strict';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

function configuration(env) {
  const url = new URL(env.SAMPLE_URL || 'http://localhost:4000');
  assert(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.equal(url.protocol, 'http:');
  assert(!url.username && !url.password && !url.search && !url.hash);
  const timeout = Number(env.TOGGLY_ACCEPTANCE_TIMEOUT_MS || 300000);
  assert(Number.isInteger(timeout) && timeout >= 1000 && timeout <= 3600000);
  assert(isAbsolute(env.PLAYWRIGHT_MODULE_PATH || ''));
  return { url: url.href, timeout, module: env.PLAYWRIGHT_MODULE_PATH };
}

function emit(stage, check) {
  // Do not print URLs, browser errors, cookies, DOM dumps or response bodies.
  process.stdout.write(`${JSON.stringify({ stage, ...(check ? { check } : {}) })}\n`);
}

let browser;
let check = 'configuration';
try {
  const config = configuration(process.env);
  if (process.argv.includes('--check')) {
    emit('configuration_checked');
  } else {
    assert.equal(process.argv.length, 2);
    check = 'browser_launch';
    const { chromium } = await import(pathToFileURL(config.module).href);
    browser = await chromium.launch({ headless: true });
    const alice = await (await browser.newContext()).newPage();
    const bob = await (await browser.newContext()).newPage();
    for (const page of [alice, bob]) {
      page.setDefaultTimeout(15000);
      check = 'live_connection';
      await page.goto(config.url);
      await page.locator('[data-phx-main].phx-connected').waitFor();
      check = 'live_mode_required';
      assert.equal(await page.locator('#missing-key').count(), 0);
      check = 'dashboard_initial_on';
      await page.locator('#new-dashboard').waitFor();
    }
    await bob.locator('[phx-click="preset"][phx-value-mode="nonmatching"]').click();
    await bob.waitForFunction(() => document.querySelector('#current-identity')?.textContent.trim() === 'bob');
    const contexts = async () => {
      assert.equal((await alice.locator('#current-identity').innerText()).trim(), 'alice');
      assert.equal((await bob.locator('#current-identity').innerText()).trim(), 'bob');
      assert.match(await alice.locator('#express-result').innerText(), /ExpressCheckout available/);
      assert.match(await bob.locator('#express-result').innerText(), /Standard checkout/);
      for (const key of ['filter-targeting', 'filter-context-property']) {
        assert.equal((await alice.locator(`#${key}`).innerText()).trim(), 'ON');
        assert.equal((await bob.locator(`#${key}`).innerText()).trim(), 'OFF');
      }
    };
    check = 'isolated_contexts';
    await contexts();
    emit('browser_ready_toggle_dashboard_off');

    // These waits inspect existing DOMs. No reload, refresh click, fetch loop,
    // network interception or replacement definitions can satisfy the transition.
    for (const [selector, stage] of [
      ['#classic-dashboard', 'dashboard_off_toggle_on'],
      ['#new-dashboard', 'dashboard_on_observed'],
    ]) {
      check = stage;
      await Promise.all([alice, bob].map(page => page.locator(selector).waitFor({ timeout: config.timeout })));
      await contexts();
      emit(stage);
    }
  }
} catch {
  emit('browser_failed', check);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
