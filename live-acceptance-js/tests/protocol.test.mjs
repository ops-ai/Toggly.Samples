import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, transition } from '../protocol.mjs';
test('live input requires keys and refuses local fixture endpoints', () => {
  assert.throws(() => configuration({}), /family/);
  assert.throws(() => configuration({ LIVE_FAMILY: 'nest' }), /backend/);
  assert.throws(
    () =>
      configuration({
        LIVE_FAMILY: 'solid',
        LIVE_FRONTEND_KEY: 'private-value',
        LIVE_BASE_URL: 'http://127.0.0.1',
      }),
    /HTTPS/,
  );
  const c = configuration({ LIVE_FAMILY: 'solid', LIVE_FRONTEND_KEY: 'value' });
  assert.equal(c.frontendKey, 'value');
  assert.equal(c.environment, 'Production');
});
test('flag changes without an ordered real frame and signed refetch are not accepted', () => {
  assert.equal(transition({ value: false, frame: 0, fetch: 2, decision: 3 }, false), false);
  assert.equal(transition({ value: false, frame: 3, fetch: 2, decision: 4 }, false), false);
  assert.equal(transition({ value: false, frame: 1, fetch: 2, decision: 3 }, false), true);
  assert.equal(transition({ value: true, frame: 1, fetch: 2, decision: 3 }, false), false);
});
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { stop } from '../runner.mjs';
test('CLI refuses missing live inputs without disclosing supplied credentials', async () => {
  const child = spawn(process.execPath, ['run.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: {
      PATH: process.env.PATH,
      LIVE_FAMILY: 'sveltekit',
      LIVE_BACKEND_KEY: 'do-not-print-key-sentinel',
    },
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.doesNotMatch(output, /do-not-print-key-sentinel/);
  assert.match(output, /inputs missing/);
});
test(
  'owned stubborn child is terminated after bounded graceful shutdown',
  { timeout: 10000 },
  async () => {
    const child = spawn(
      process.execPath,
      ['-e', "process.on('SIGTERM',()=>{});console.log('ready');setInterval(()=>{},1000)"],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    await once(child.stdout, 'data');
    await stop(child);
    assert.equal(child.signalCode, 'SIGKILL');
  },
);
