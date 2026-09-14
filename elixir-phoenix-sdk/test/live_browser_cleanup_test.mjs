// LOCAL LIFECYCLE FIXTURES ONLY: no service, credentials or browser is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

for (const mode of ['reject', 'stall']) {
  test(`owned browser cleanup ${mode} is bounded, sanitized and preserves the primary failure`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'toggly-browser-cleanup-test-'));
    const pidFile = join(directory, 'owned.pid');
    const driver = join(directory, 'driver.mjs');
    await writeFile(
      driver,
      `
      import { spawn } from 'node:child_process';
      import { writeFileSync } from 'node:fs';
      const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: 'ignore' });
      writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
      const failClose = async () => {
        if (${JSON.stringify(mode)} === 'reject') throw new Error('CLEANUP_PRIVACY_SENTINEL');
        await new Promise(() => {});
      };
      const browser = { newContext: async () => { throw new Error('PRIMARY_PRIVACY_SENTINEL'); }, close: failClose };
      export const chromium = {
        launch: async () => browser,
        launchServer: async () => ({ process: () => child, wsEndpoint: () => 'fixture-only', close: failClose }),
        connect: async () => browser
      };
    `,
    );
    const runner = spawn(process.execPath, ['scripts/live-browser.mjs'], {
      env: {
        PATH: process.env.PATH,
        PLAYWRIGHT_MODULE_PATH: driver,
        TOGGLY_ACCEPTANCE_TIMEOUT_MS: '1000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    runner.stdout.on('data', (data) => {
      output += data;
    });
    runner.stderr.on('data', (data) => {
      output += data;
    });
    let timer;
    try {
      const [status] = await Promise.race([
        once(runner, 'exit'),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Runner exceeded cleanup deadline')), 4000);
        }),
      ]);
      assert.equal(status, 1);
      assert.doesNotMatch(output, /CLEANUP_PRIVACY_SENTINEL|PRIMARY_PRIVACY_SENTINEL/);
      const events = output
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      assert.deepEqual(events, [
        { stage: 'browser_failed', check: 'browser_launch' },
        { stage: 'browser_cleanup_failed', check: 'browser_launch' },
      ]);
      const pid = Number(await readFile(pidFile, 'utf8'));
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    } finally {
      clearTimeout(timer);
      if (runner.exitCode === null && runner.signalCode === null) {
        runner.kill('SIGKILL');
        await once(runner, 'exit');
      }
      try {
        process.kill(Number(await readFile(pidFile, 'utf8')), 'SIGKILL');
      } catch {}
      await rm(directory, { recursive: true, force: true });
    }
  });
}
