import { createApp } from './app.js';
import { closeExpressToggly } from '@ops-ai/toggly-express';
import { startFixture } from './fixture.js';
const fixture = process.argv.includes('--offline') ? await startFixture() : undefined;
const app = createApp({ appKey: process.env.TOGGLY_APP_KEY, environment: process.env.TOGGLY_ENVIRONMENT, fixtureUrl: fixture?.baseUrl });
const server = app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1', () => console.log(`Node Express SDK Sample: http://localhost:${server.address().port} (${fixture ? 'OFFLINE FIXTURE' : 'see configuration banner'})`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { closeExpressToggly(); server.close(); await fixture?.close(); });
