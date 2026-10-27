/**
 * Live E2E parity: default `npm run build` + Node SSR entry (not static preview).
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
const npm = process.env.npm_execpath ?? 'npm';
const root = process.cwd();

function runBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npm, 'run', 'build'], {
      cwd: root,
      env: {
        ...process.env,
        TOGGLY_APP_KEY: '',
        TOGGLY_DEFINITIONS_BASE_URI: '',
        TOGGLY_METRICS_BASE_URL: '',
      },
      stdio: 'inherit',
    });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`build exited ${code}`)),
    );
  });
}

async function waitForOrigin(origin) {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(origin);
      if (res.ok) return;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server not ready at ${origin}`);
}

await runBuild();
assert.ok(existsSync('dist/server/entry.mjs'), 'default build must emit Node SSR entry');
assert.ok(
  !existsSync('dist/index.html'),
  'default build must not emit static dist/index.html',
);

const port = 4331;
const server = spawn(process.execPath, ['dist/server/entry.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    TOGGLY_APP_KEY: '',
  },
  stdio: 'inherit',
});
const stopped = once(server, 'exit');

try {
  const origin = `http://127.0.0.1:${port}`;
  await waitForOrigin(origin);

  const res = await fetch(`${origin}/?preset=matching`);
  assert.equal(res.headers.get('x-toggly-middleware'), 'applied');
  assert.equal(res.headers.get('x-toggly-identity'), 'alice');
  const html = await res.text();
  assert.match(html, /id="filter-matrix"/, 'SSR must render the server filter matrix per request');
  assert.match(
    html,
    /id="filter-identity"[\s\S]*<code>alice<\/code>/,
    '?preset=matching must reach SSR evaluation context (not static SSG)',
  );
} finally {
  server.kill('SIGTERM');
  await stopped;
}

console.log('Astro harness start (default SSR build + node dist/server/entry.mjs) passed.');
