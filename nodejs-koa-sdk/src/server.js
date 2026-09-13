import 'node:process';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { startFixture } from './fixture.js';
import { closeKoaToggly } from '@ops-ai/toggly-koa';

const offline = process.argv.includes('--offline');
const fixture = offline ? await startFixture() : undefined;
const server = createServer(createApp({
  appKey: process.env.TOGGLY_APP_KEY,
  environment: process.env.TOGGLY_ENVIRONMENT || 'Production',
  fixtureUrl: fixture?.baseUrl,
}).callback());
const port = Number(process.env.PORT || 3000);
server.listen(port, () => console.log(`Node Koa SDK Sample listening on http://localhost:${port} (${offline ? 'offline fixture' : 'configured/default mode'})`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  closeKoaToggly();
  server.close();
  await fixture?.close();
  process.exit(0);
});
