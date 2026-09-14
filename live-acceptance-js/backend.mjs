// Child-only environment inputs. Provider errors/URLs never cross IPC or stdout.
import 'reflect-metadata';
import { WebSocket } from 'ws';
const config = JSON.parse(process.env.LIVE_CHILD_CONFIG);
let sequence = 0,
  frame = 0,
  fetched = 0,
  denied = 0;
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  if (config.offline) {
    denied++;
    throw new Error('Network denied by acceptance harness');
  }
  const response = await nativeFetch(...args);
  if (String(args[0]).includes('/definitions-signed/') && response.ok) {
    const body = await response.clone().json();
    if (body.signature && body.kid && body.timestamp) fetched = ++sequence;
  }
  return response;
};
const { updateFrame } = await import('./protocol.mjs');
const emit = WebSocket.prototype.emit;
WebSocket.prototype.emit = function (event, ...args) {
  if (event === 'message' && updateFrame(args[0])) frame = ++sequence;
  return emit.call(this, event, ...args);
};
const options = {
  appKey: config.backendKey,
  baseUrl: config.baseURI,
  environment: config.environment,
  verifySignatures: true,
  enableStreaming: !config.offline,
  refreshInterval: 0,
  enableFileCache: true,
  fileCachePath: config.cachePath,
  enableUsageTracking: false,
  enableMetrics: false,
  registerContextsOnStartup: false,
  timeout: 3000,
};
let client, app;
if (config.family === 'nest') {
  const { Module } = await import('@nestjs/common');
  const { NestFactory } = await import('@nestjs/core');
  const { TogglyModule, TogglyProvider } = await import('@ops-ai/toggly-nestjs');
  class Root {}
  Module({
    imports: [
      TogglyModule.forRoot({
        ...options,
        contextFactory: (req) => req.context,
      }),
    ],
  })(Root);
  app = await NestFactory.createApplicationContext(Root, { logger: false });
  await app.init();
  client = app.get(TogglyProvider).client;
} else {
  const adapter = await import(
    config.family === 'solidstart'
      ? '@ops-ai/solid-feature-flags-toggly/server'
      : '@ops-ai/toggly-sveltekit/server'
  );
  client = adapter.createTogglyClient(options);
  await client.init();
}
const context = (identity) => ({
  identity,
  groups: identity === 'alice' ? ['staff'] : [],
  claims: { role: identity === 'alice' ? 'admin' : 'user' },
});
async function scope(identity) {
  const ctx = context(identity);
  if (config.family === 'nest') {
    const { ContextIdFactory } = await import('@nestjs/core');
    const { TogglyService } = await import('@ops-ai/toggly-nestjs');
    const id = ContextIdFactory.create();
    app.registerRequestByContextId({ context: ctx }, id);
    const service = await app.resolve(TogglyService, id);
    return {
      evaluate: (key, entity) => service.isFeatureOn(key, { entity }),
      dispose() {},
    };
  }
  if (config.family === 'solidstart') {
    const { createTogglyRequest } = await import('@ops-ai/solid-feature-flags-toggly/server');
    const s = createTogglyRequest({
      client,
      request: new Request('http://localhost/'),
      context: ctx,
      clientContext: ctx,
      frontend: {
        appKey: config.frontendKey,
        environment: config.environment,
        baseURI: config.baseURI,
        expose: ['new-dashboard', 'filter-targeting', 'ExpressCheckout'],
      },
    });
    return {
      evaluate: (key, entity) => s.isEnabled(key, entity),
      snapshot: () => s.snapshot(),
      dispose: () => s.dispose(),
    };
  }
  const { createTogglyHandle, loadToggly } = await import('@ops-ai/toggly-sveltekit/server');
  const event = {
    url: new URL('http://localhost/'),
    request: new Request('http://localhost/'),
    locals: {},
  };
  await createTogglyHandle({
    client,
    context: () => ctx,
    clientContext: () => ctx,
    frontend: {
      appKey: config.frontendKey,
      environment: config.environment,
      baseURI: config.baseURI,
      expose: ['new-dashboard', 'filter-targeting', 'ExpressCheckout'],
    },
  })({ event, resolve: async () => new Response('ok') });
  return {
    evaluate: (key, entity) => event.locals.toggly.isEnabled(key, { entity }),
    snapshot: () => loadToggly(event),
    dispose() {},
  };
}
process.on('message', async (message) => {
  try {
    if (message.command === 'close') {
      await (app ? app.close() : client.close());
      process.send({ id: message.id, result: true });
      process.disconnect();
      return;
    }
    if (message.command === 'reset') {
      frame = 0;
      fetched = 0;
      process.send({ id: message.id, result: true });
      return;
    }
    const s = await scope(message.identity || 'alice');
    try {
      const result =
        message.command === 'snapshot'
          ? await s.snapshot()
          : {
              value: await s.evaluate('new-dashboard'),
              targeted: await s.evaluate('filter-targeting'),
              vip: await s.evaluate('ExpressCheckout', {
                kind: 'Order',
                key: 'vip',
                attributes: { Vip: true },
              }),
              standard: await s.evaluate('ExpressCheckout', {
                kind: 'Order',
                key: 'standard',
                attributes: { Vip: false },
              }),
              frame,
              fetch: fetched,
              decision: ++sequence,
              error: !!client.state.error,
              initialized: client.state.initialized,
              ws: client.state.wsConnected,
              denied,
            };
      process.send({ id: message.id, result });
    } finally {
      s.dispose();
    }
  } catch {
    process.send({
      id: message.id,
      error: 'Backend acceptance command failed',
    });
  }
});
process.send({ ready: true });
