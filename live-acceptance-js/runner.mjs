import assert from 'node:assert/strict';
import { fork, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { until, transition } from './protocol.mjs';
const childEnvironment = () =>
  Object.fromEntries(
    ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'SystemRoot', 'DISPLAY', 'XDG_RUNTIME_DIR']
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
const directory = fileURLToPath(new URL('.', import.meta.url));
export async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  try {
    await until(() => child.exitCode !== null || child.signalCode !== null, 3000, 'child shutdown');
  } catch {
    child.kill('SIGKILL');
    await until(() => child.exitCode !== null || child.signalCode !== null, 3000, 'child kill');
  }
}
async function backend(config) {
  const child = fork(join(directory, 'backend.mjs'), {
    env: { ...childEnvironment(), LIVE_CHILD_CONFIG: JSON.stringify(config) },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  let ready = false,
    id = 0;
  const pending = new Map();
  child.on('message', (m) => {
    if (m.ready) ready = true;
    else if (pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      clearTimeout(p.timer);
      m.error ? p.reject(new Error(m.error)) : p.resolve(m.result);
    }
  });
  child.on('exit', () => {
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('Backend process exited'));
    }
    pending.clear();
  });
  try {
    await until(
      () => {
        if (child.exitCode !== null) throw new Error('Backend initialization failed');
        return ready;
      },
      15000,
      'backend initialization',
    );
  } catch (e) {
    await stop(child);
    throw e;
  }
  const call = (command, identity) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      const timer = setTimeout(() => {
        pending.delete(n);
        reject(new Error('Backend command deadline'));
      }, 10000);
      pending.set(n, { resolve, reject, timer });
      child.send({ id: n, command, identity });
    });
  return {
    call,
    async close() {
      try {
        await call('close');
      } finally {
        await stop(child);
      }
    },
  };
}
// This runs before SDK code. It observes transport without fulfilling a request.
function observe() {
  window.transportSequence = 0;
  window.transportEvidence = { frame: 0, fetch: 0, sockets: 0, denied: 0 };
  const native = window.fetch;
  window.fetch = async (...args) => {
    let response;
    try {
      response = await native(...args);
    } catch (error) {
      window.transportEvidence.denied++;
      throw error;
    }
    if (String(args[0]).includes('/evaluated-signed/') && response.ok) {
      const body = await response.clone().json();
      if (body.signature && body.kid && body.timestamp)
        window.transportEvidence.fetch = ++window.transportSequence;
    }
    return response;
  };
  const Native = window.WebSocket;
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args);
      this.addEventListener('open', () => window.transportEvidence.sockets++);
      this.addEventListener('message', (event) => {
        try {
          const text = String(event.data);
          const m = ['update', 'flags-updated'].includes(text) ? { type: text } : JSON.parse(text);
          if (['update', 'flags-updated'].includes(m.type))
            window.transportEvidence.frame = ++window.transportSequence;
        } catch {}
      });
    }
  };
}
async function browser(profile, origin, offline) {
  await rm(join(profile, 'DevToolsActivePort'), { force: true });
  const child = spawn(
    chromium.executablePath(),
    [
      '--headless',
      '--no-sandbox',
      '--use-mock-keychain',
      '--password-store=basic',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore', env: childEnvironment() },
  );
  let connection;
  try {
    let port;
    await until(
      async () => {
        if (child.exitCode !== null) throw new Error('Browser exited');
        try {
          port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
          return /^\d+$/.test(port);
        } catch {
          return false;
        }
      },
      15000,
      'browser process',
    );
    await until(
      async () => {
        try {
          connection = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 });
          return true;
        } catch {
          return false;
        }
      },
      10000,
      'browser CDP listener',
    );
    const context = connection.contexts()[0];
    await context.addInitScript(observe);
    if (offline) {
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort('internetdisconnected'),
      );
      await context.routeWebSocket('**/*', (socket) => socket.close());
    }
    return {
      context,
      async close() {
        try {
          await Promise.race([
            connection.close(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Browser close deadline')), 3000),
            ),
          ]);
        } finally {
          await stop(child);
        }
      },
    };
  } catch (e) {
    await stop(child);
    throw e;
  }
}
async function probePage(context, origin, config, identity, seed) {
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(origin);
  await page.waitForFunction(() => typeof window.boot === 'function');
  // Only public frontend configuration is sent to browser; never backend keys.
  await page.evaluate(({ config, identity, seed }) => window.boot(config, identity, seed), {
    config: {
      family: config.family,
      frontendKey: config.frontendKey,
      baseURI: config.baseURI,
      environment: config.environment,
    },
    identity,
    seed,
  });
  return page;
}
async function checked(page, identity) {
  return until(
    async () => {
      const s = await page.evaluate(() => window.probe());
      return (
        s.value === true &&
        s.targeted === (identity === 'alice') &&
        s.vip &&
        !s.standard &&
        s.fetch > 0 &&
        s.sockets > 0 &&
        s
      );
    },
    15000,
    'signed browser initialization/context',
  );
}
export async function acceptance(config, stage = async () => {}) {
  const wait = (...args) => until(...args, config.signal);
  const temp = await mkdtemp(join(tmpdir(), 'toggly-live-js-'));
  let server, host, b, failure;
  try {
    config = { ...config, cachePath: join(temp, 'backend-cache') };
    let seeds = {};
    if (config.family !== 'solid') {
      server = await backend(config);
      const a = await server.call('probe', 'alice'),
        bob = await server.call('probe', 'bob');
      assert.ok(
        a.initialized && !a.error && a.value && a.targeted && a.vip && !a.standard && a.fetch > 0,
        'Verified backend baseline required',
      );
      assert.equal(bob.targeted, false, 'Backend contexts leaked');
      await wait(async () => (await server.call('probe')).ws, 15000, 'backend WebSocket');
      if (config.family !== 'nest')
        for (const identity of ['alice', 'bob']) {
          seeds[identity] = await server.call('snapshot', identity);
          assert.equal(seeds[identity].source, 'signed');
          assert.equal(seeds[identity].definitions['filter-targeting'], identity === 'alice');
        }
      for (const expected of [false, true]) {
        await server.call('reset');
        await stage(expected ? 'backend-on' : 'backend-off');
        await wait(
          async () => transition(await server.call('probe'), expected),
          config.timeout,
          'backend frame/signed refetch/decision',
        );
      }
      await server.close();
      server = await backend({ ...config, offline: true });
      const cached = await server.call('probe', 'alice');
      assert.ok(
        cached.value &&
          cached.targeted &&
          cached.vip &&
          !cached.standard &&
          cached.denied > 0 &&
          cached.fetch === 0 &&
          !cached.ws,
        'Cold parsed backend cache required',
      );
      assert.equal((await server.call('probe', 'bob')).targeted, false);
      await stage('backend-cold-parsed-cache');
      await server.close();
      server = null;
    }
    if (config.family !== 'nest') {
      const bundle = await readFile(join(directory, 'dist/browser.js'));
      host = createServer((req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        if (req.url === '/probe.js') {
          res.setHeader('Content-Type', 'text/javascript');
          res.end(bundle);
        } else {
          res.setHeader('Content-Type', 'text/html');
          res.end(
            '<!doctype html><title>SDK acceptance probe</title><script type="module" src="/probe.js"></script>',
          );
        }
      });
      await new Promise((resolve, reject) => {
        host.once('error', reject);
        host.listen(config.port || 0, '127.0.0.1', resolve);
      });
      const origin = `http://127.0.0.1:${host.address().port}`;
      const profile = join(temp, 'browser-profile');
      b = await browser(profile, origin, false);
      const alice = await probePage(b.context, origin, config, 'alice', seeds.alice);
      const bob = await probePage(b.context, origin, config, 'bob', seeds.bob);
      await Promise.all([checked(alice, 'alice'), checked(bob, 'bob')]);
      for (const expected of [false, true]) {
        for (const page of [alice, bob])
          await page.evaluate(() => {
            window.transportEvidence.frame = 0;
            window.transportEvidence.fetch = 0;
          });
        await stage(expected ? 'browser-on' : 'browser-off');
        await wait(
          async () => {
            const [a, c] = await Promise.all([
              alice.evaluate(() => window.probe()),
              bob.evaluate(() => window.probe()),
            ]);
            return transition(a, expected) && transition(c, expected) && a.targeted && !c.targeted;
          },
          config.timeout,
          'browser frame/signed refetch/decision',
        );
      }
      await b.close();
      b = null;
      // A completely new browser process, same origin profile, no SSR seed or network.
      b = await browser(profile, origin, true);
      const restored = await probePage(b.context, origin, config, 'alice');
      await wait(
        async () => {
          const s = await restored.evaluate(() => window.probe());
          return (
            s.value &&
            s.targeted &&
            s.vip &&
            !s.standard &&
            s.fetch === 0 &&
            s.sockets === 0 &&
            s.denied > 0
          );
        },
        15000,
        'cold signed browser persistence',
      );
      const stranger = await probePage(b.context, origin, config, 'uncached-user');
      await wait(
        async () => (await stranger.evaluate(() => window.probe())).denied > 0,
        5000,
        'uncached offline refresh denied',
      );
      assert.equal(
        (await stranger.evaluate(() => window.probe())).value,
        false,
        'Uncached identity inherited stored flags',
      );
      // Corrupt actual SDK storage, then create another owner; parsed data is not trusted.
      await restored.evaluate(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.includes(':envelope:')) localStorage.setItem(key, '{}');
        }
      });
      const corrupt = await probePage(b.context, origin, config, 'alice');
      await wait(
        async () => (await corrupt.evaluate(() => window.probe())).denied > 0,
        5000,
        'corrupt offline refresh denied',
      );
      assert.equal(
        (await corrupt.evaluate(() => window.probe())).value,
        false,
        'Corrupt stored envelope accepted',
      );
      await stage('browser-cold-signed-envelope');
    }
    return { runtime: true, sampleUI: 'pending' };
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    const results = await Promise.allSettled([
      b?.close(),
      server?.close(),
      host && new Promise((r) => host.close(r)),
    ]);
    await rm(temp, { recursive: true, force: true });
    const errors = results.filter((r) => r.status === 'rejected').map((r) => r.reason);
    if (errors.length)
      throw new AggregateError(
        failure ? [failure, ...errors] : errors,
        'Owned acceptance resources failed cleanup',
      );
  }
}
