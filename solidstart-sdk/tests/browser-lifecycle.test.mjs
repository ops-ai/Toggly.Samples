import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { runWithCleanup, stopOwnedProcess } from './browser-lifecycle.mjs';

async function childFixture(t, ignoreTerm = false) {
  const child = spawn(
    process.execPath,
    [
      '-e',
      `
    process.on('SIGTERM', () => { ${ignoreTerm ? '' : 'process.exit(0);'} });
    process.send('ready');
    setInterval(() => {}, 1000);
  `,
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] },
  );
  const closed = once(child, 'close');
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
  });
  await once(child, 'message');
  return child;
}

test('cleanup awaits normal child shutdown without forcing it', { timeout: 3000 }, async (t) => {
  const child = await childFixture(t);
  await stopOwnedProcess(child, 'fixture', { graceMs: 200, forceMs: 1000 });
  assert.equal(child.exitCode, 0);
  assert.equal(child.signalCode, null);
});

test('cleanup kills and reaps a child that ignores SIGTERM', { timeout: 3000 }, async (t) => {
  const child = await childFixture(t, true);
  const messages = [];
  await stopOwnedProcess(child, 'fixture', {
    graceMs: 100,
    forceMs: 1000,
    report: (message) => messages.push(message),
  });
  assert.equal(child.signalCode, 'SIGKILL');
  assert.match(messages.join('\n'), /fixture.*forcing shutdown/);
});

test(
  'a stalled browser close promise cannot prevent forced process cleanup',
  { timeout: 3000 },
  async (t) => {
    const child = await childFixture(t, true);
    await stopOwnedProcess(child, 'browser fixture', {
      graceMs: 100,
      forceMs: 1000,
      close: () => new Promise(() => {}),
      report: () => {},
    });
    assert.equal(child.signalCode, 'SIGKILL');
  },
);

test(
  'a stalled forced-close promise fails within its second deadline',
  { timeout: 3000 },
  async (t) => {
    const child = await childFixture(t, true);
    await assert.rejects(
      stopOwnedProcess(child, 'browser fixture', {
        graceMs: 100,
        forceMs: 100,
        close: () => new Promise(() => {}),
        kill: () => {
          child.kill('SIGKILL');
          return new Promise(() => {});
        },
        report: () => {},
      }),
      /browser fixture forced close exceeded 100ms/,
    );
    assert.equal(child.signalCode, 'SIGKILL');
  },
);

test('assertion failure survives successful cleanup', async () => {
  const assertion = new Error('identity assertion failed');
  let cleaned = false;
  await assert.rejects(
    runWithCleanup(
      async () => {
        throw assertion;
      },
      async () => {
        cleaned = true;
      },
    ),
    (error) => error === assertion,
  );
  assert.equal(cleaned, true);
});

test('assertion and cleanup failures are both retained', async () => {
  const assertion = new Error('identity assertion failed');
  const cleanup = new Error('owned process did not close');
  await assert.rejects(
    runWithCleanup(
      async () => {
        throw assertion;
      },
      async () => {
        throw cleanup;
      },
    ),
    (error) =>
      error instanceof AggregateError &&
      error.cause === assertion &&
      error.errors[0] === assertion &&
      error.errors[1] === cleanup,
  );
});

test('cleanup failure makes otherwise successful assertions fail', async () => {
  const cleanup = new Error('owned process did not close');
  await assert.rejects(
    runWithCleanup(
      async () => {},
      async () => {
        throw cleanup;
      },
    ),
    (error) => error === cleanup,
  );
});
