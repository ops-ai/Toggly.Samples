import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { chromium } from 'playwright';
import {
  importDevelopmentToolbar,
  runWithCleanup,
  stopOwnedProcess,
} from './browser-lifecycle.mjs';

test('a stalled real browser module import fails within its deadline and cleans up', async () => {
  let moduleRequested = false;
  const server = createServer((request, response) => {
    if (request.url.includes('/error-viewer/')) {
      moduleRequested = true;
      // Keep the actual HTTP module response pending; never fulfill a fake module.
      return;
    }
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><title>Module deadline fixture</title>');
  });
  let browserServer;
  let browser;
  let guard;
  await assert.rejects(
    runWithCleanup(
      async () => {
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        browserServer = await chromium.launchServer({ headless: true, timeout: 10_000 });
        browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 10_000 });
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}`, { timeout: 5000 });
        await Promise.race([
          importDevelopmentToolbar(page, 300),
          new Promise((_, reject) => {
            // This separate guard makes a broken deadline fail, while still
            // allowing the real browser and held connection to be cleaned up.
            guard = setTimeout(() => reject(new Error('Regression outer guard fired')), 2000);
          }),
        ]);
      },
      async () => {
        clearTimeout(guard);
        const results = await Promise.allSettled([
          browserServer &&
            stopOwnedProcess(browserServer.process(), 'Toolbar fixture browser', {
              close: async () => {
                await browser?.close();
                await browserServer.close();
              },
              kill: () => browserServer.kill(),
            }),
          new Promise((resolve, reject) => {
            server.closeAllConnections();
            server.close((error) => (error ? reject(error) : resolve()));
          }),
        ]);
        const failures = results
          .filter((result) => result.status === 'rejected')
          .map((result) => result.reason);
        if (failures.length) throw new AggregateError(failures, 'Toolbar fixture cleanup failed');
      },
    ),
    /Development toolbar import exceeded 300ms/,
  );
  assert.equal(moduleRequested, true);
  assert.equal(server.listening, false);
  assert.ok(
    browserServer.process().exitCode !== null || browserServer.process().signalCode !== null,
  );
});
