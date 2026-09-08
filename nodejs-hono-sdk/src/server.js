import { serve } from '@hono/node-server';
import { closeHonoToggly } from '@ops-ai/toggly-hono';
import { createApp } from './app.js';
import { startFixture } from './fixture.js';

const fixture = process.argv.includes('--offline') ? await startFixture() : undefined;
const app = createApp({ appKey: process.env.TOGGLY_APP_KEY, environment: process.env.TOGGLY_ENVIRONMENT, fixtureUrl: fixture?.baseUrl });
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: Number(process.env.PORT ?? 3000) }, info => console.log(`Hono sample at http://localhost:${info.port} (${fixture ? 'Offline fixture' : 'configured or missing key; see page banner'})`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(async () => {
    closeHonoToggly();
    await fixture?.close();
  });
  server.closeIdleConnections();
});
