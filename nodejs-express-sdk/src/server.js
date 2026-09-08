import { createApp } from './app.js';
import { closeExpressToggly } from '@ops-ai/toggly-express';
import { startFixture } from './fixture.js';
// --offline selects local transport explicitly. Normal startup reads the server's
// environment via the package script; no browser SDK or public env prefix is involved.
const fixture = process.argv.includes('--offline') ? await startFixture() : undefined;
// Creating/listening does not itself prove SDK readiness: the first request awaits
// middleware initialization, then the response banner reports fetch provenance.
const app = createApp({ appKey: process.env.TOGGLY_APP_KEY, environment: process.env.TOGGLY_ENVIRONMENT, fixtureUrl: fixture?.baseUrl });
const server = app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1', () => console.log(`Node Express SDK Sample: http://localhost:${server.address().port} (${fixture ? 'OFFLINE FIXTURE' : 'see configuration banner'})`));
// Close the shared adapter client once on process shutdown, not after each request.
// This releases SDK timers/connections; also stop both the app and fixture listeners.
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { closeExpressToggly(); server.close(); await fixture?.close(); });
