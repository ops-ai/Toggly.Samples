import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const key = (process.env.TOGGLY_APP_KEY || '').trim();
if (!key || key === 'ci-placeholder') {
  console.log('soak skipped: no live TOGGLY_APP_KEY');
  process.exit(0);
}

const refresh = Number(process.env.TOGGLY_REFRESH_INTERVAL_MS || 5000);
const flush = Number(process.env.TOGGLY_USAGE_FLUSH_INTERVAL_MS || 5000);
const slack = 10_000;
const waitMs = refresh + flush + slack;
const entry = fileURLToPath(new URL('../src/server.js', import.meta.url));
const child = spawn(process.execPath, [entry], {
  env: {
    ...process.env,
    TOGGLY_REFRESH_INTERVAL_MS: String(refresh),
    TOGGLY_USAGE_FLUSH_INTERVAL_MS: String(flush),
    PORT: process.env.PORT || '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const exited = once(child, 'exit');

try {
  await delay(waitMs);
  console.log(`soak complete: waited ${waitMs}ms (refresh ${refresh}ms + flush ${flush}ms + slack ${slack}ms)`);
} finally {
  if (!child.killed) child.kill('SIGTERM');
  await Promise.race([exited, delay(5000)]);
}
