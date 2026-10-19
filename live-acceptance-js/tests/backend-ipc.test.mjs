import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backend } from '../runner.mjs';
import { backendCommandDeadlineMs } from '../protocol.mjs';
import { fixture } from './fixture.mjs';

async function nestBackend(service, extra = {}) {
  const temp = await mkdtemp(join(tmpdir(), 'toggly-backend-ipc-'));
  const cachePath = join(temp, 'cache');
  const server = await backend({
    family: 'nest',
    backendKey: 'fixture-backend',
    baseURI: service.baseURI,
    environment: 'Production',
    cachePath,
    ...extra,
  });
  return { server, cachePath };
}

test('backend IPC deadline follows config.timeout', async () => {
  const service = await fixture();
  const timeout = 20000;
  const delayMs = 12000;
  assert.ok(delayMs > 10000, 'delay must exceed the old hardcoded 10s parent cap');
  assert.ok(delayMs < timeout, 'delay must finish within child config.timeout');
  const { server } = await nestBackend(service, {
    timeout,
    harnessTestMode: true,
    harnessDelayMs: delayMs,
  });
  try {
    const start = Date.now();
    await server.call('harness-delay');
    assert.ok(Date.now() - start >= delayMs - 500);
    assert.equal(backendCommandDeadlineMs(timeout), timeout + 5000);
  } finally {
    await server.close();
    await service.close();
  }
});

test('backend IPC surfaces child error message and stack', async () => {
  const service = await fixture();
  const message = 'OPS-1936 harness IPC child failure sentinel';
  const { server } = await nestBackend(service, {
    timeout: 15000,
    harnessTestMode: true,
    harnessErrorMessage: message,
  });
  try {
    await assert.rejects(server.call('harness-throw'), (error) => {
      assert.equal(error.message, message);
      assert.match(error.stack, /backend\.mjs/);
      assert.doesNotMatch(error.message, /Backend acceptance command failed/);
      return true;
    });
  } finally {
    await server.close();
    await service.close();
  }
});

test('backend IPC rejects when child error message is empty', async () => {
  const service = await fixture();
  const { server } = await nestBackend(service, {
    timeout: 15000,
    harnessTestMode: true,
    harnessErrorMessage: '',
  });
  try {
    await assert.rejects(server.call('harness-throw'), (error) => {
      assert.equal(error.message, '');
      return true;
    });
  } finally {
    await server.close();
    await service.close();
  }
});

test('backend sync waits for on-disk definitions cache', async () => {
  const service = await fixture();
  const { server, cachePath } = await nestBackend(service, { timeout: 15000 });
  try {
    await server.call('probe', 'alice');
    await server.call('sync');
    await access(join(cachePath, 'toggly_definitions.json'));
  } finally {
    await server.close();
    await service.close();
  }
});
