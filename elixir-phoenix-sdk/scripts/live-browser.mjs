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

async function deadline(work, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Owned cleanup deadline')), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const exited = (child) => child.exitCode !== null || child.signalCode !== null;

async function terminateOwned(child) {
  if (!child || exited(child)) return;
  let finished;
  const exit = new Promise((resolve) => {
    finished = resolve;
    child.once('exit', finished);
  });
  try {
    // The handle comes from this invocation's BrowserServer, never a PID search.
    child.kill('SIGKILL');
    await deadline(exit, 1000);
  } finally {
    child.off('exit', finished);
  }
}

let browser;
let server;
let ownedProcess;
let check = 'configuration';
try {
  const config = configuration(process.env);
  if (process.argv.includes('--check')) {
    emit('configuration_checked');
  } else {
    assert.equal(process.argv.length, 2);
    check = 'browser_launch';
    const { chromium } = await import(pathToFileURL(config.module).href);
    server = await chromium.launchServer({ headless: true, host: '127.0.0.1' });
    ownedProcess = server.process();
    browser = await chromium.connect(server.wsEndpoint());
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
    await bob.waitForFunction(
      () => document.querySelector('#current-identity')?.textContent.trim() === 'bob',
    );
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
      await Promise.all(
        [alice, bob].map((page) => page.locator(selector).waitFor({ timeout: config.timeout })),
      );
      await contexts();
      emit(stage);
    }
  }
} catch {
  emit('browser_failed', check);
  process.exitCode = 1;
} finally {
  try {
    // Bound both the client disconnect and server shutdown. A rejected close
    // must not bypass sanitization or replace an already emitted primary failure.
    const results = await deadline(
      Promise.allSettled([
        Promise.resolve().then(() => browser?.close()),
        Promise.resolve().then(() => server?.close()),
      ]),
      1000,
    );
    assert(results.every((result) => result.status === 'fulfilled'));
    assert(!ownedProcess || exited(ownedProcess));
  } catch {
    try {
      await terminateOwned(ownedProcess);
    } catch {
      // OS-level termination failure is still a failed, bounded invocation.
    }
    emit('browser_cleanup_failed', check);
    process.exit(1);
  }
}
