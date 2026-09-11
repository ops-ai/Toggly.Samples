import { createApp } from './app.js';
import { startFixture } from './fixture.js';
// --offline ignores live credentials and serves local rule definitions. Normal
// dev/start loads env files through package.json; process.env belongs to Node,
// so no VITE_ or NEXT_PUBLIC_ prefix (or browser configuration) is needed here.
const fixture = process.argv.includes('--offline') ? await startFixture() : undefined;
let app;
try {
  // Wait for plugin initialization before listening. This means initialization has
  // finished, not that live fetching succeeded: inspect the source banner/state.
  app = await createApp({ appKey: process.env.TOGGLY_APP_KEY, environment: process.env.TOGGLY_ENVIRONMENT, fixtureUrl: fixture?.baseUrl });
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '127.0.0.1' });
  console.log(`Fastify SDK sample: ${app.listeningOrigin} (${fixture ? 'Offline fixture' : process.env.TOGGLY_APP_KEY ? 'configured; inspect source banner' : 'Missing app key'})`);
} catch (error) {
  await app?.close();
  await fixture?.close();
  throw error;
}
// Fastify app.close triggers the plugin's onClose hook, stops SDK background work
// and clears its singleton. Close the separate fixture too so no listener remains.
async function close() { await app.close(); await fixture?.close(); }
process.once('SIGINT', close);
process.once('SIGTERM', close);
