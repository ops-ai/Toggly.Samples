import { serve } from '@hono/node-server';
import { closeHonoToggly } from '@ops-ai/toggly-hono';
import { createApp } from './app.js';
import { startFixture } from './fixture.js';

// --offline changes only the definitions endpoint. The same app/SDK paths run
// in both modes; environment values are read by Node, never injected into HTML.
const fixture = process.argv.includes('--offline') ? await startFixture() : undefined;
const app = createApp({ appKey: process.env.TOGGLY_APP_KEY, environment: process.env.TOGGLY_ENVIRONMENT, fixtureUrl: fixture?.baseUrl });
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: Number(process.env.PORT ?? 3000) }, info => console.log(`Hono sample at http://localhost:${info.port} (${fixture ? 'Offline fixture' : 'configured or missing key; see page banner'})`));
// Drain the HTTP server before disposing the adapter singleton and its timers.
// Closing the fixture too prevents the offline demonstration holding Node open.
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(async () => {
    closeHonoToggly();
    await fixture?.close();
  });
  server.closeIdleConnections();
});
