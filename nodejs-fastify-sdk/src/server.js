import { createApp } from './app.js';
import { startFixture } from './fixture.js';
const fixture = process.argv.includes('--offline') ? await startFixture() : undefined;
let app;
try {
  app = await createApp({ appKey: process.env.TOGGLY_APP_KEY, environment: process.env.TOGGLY_ENVIRONMENT, fixtureUrl: fixture?.baseUrl });
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '127.0.0.1' });
  console.log(`Fastify SDK sample: ${app.listeningOrigin} (${fixture ? 'Offline fixture' : process.env.TOGGLY_APP_KEY ? 'configured; inspect source banner' : 'Missing app key'})`);
} catch (error) {
  await app?.close();
  await fixture?.close();
  throw error;
}
async function close() { await app.close(); await fixture?.close(); }
process.once('SIGINT', close);
process.once('SIGTERM', close);
