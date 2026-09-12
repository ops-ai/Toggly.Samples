import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createTogglyClient, createTogglyHandle } from '@ops-ai/toggly-sveltekit/server';
import { defaults, filters, preset } from '$lib/catalog';
// Definitions are shared; identity is supplied per request below, never assigned to this client.
const client = createTogglyClient({
  appKey: env.TOGGLY_APP_KEY,
  environment: env.TOGGLY_ENVIRONMENT ?? 'Production',
  verifySignatures: true,
  featureDefaults: defaults,
  enableUsageTracking: false,
  enableMetrics: false,
});
// Initialization fetches/verifies backend definitions before hooks evaluate them.
// The shared client owns definitions and transport resources, never the current user.
await client.init();
if (!env.TOGGLY_APP_KEY) {
  // Offline fixtures exercise the actual evaluator without pretending to be dashboard configuration.
  for (const definition of filters) client.state.definitions.set(definition.featureKey, definition);
  client.state.definitions.set('ExpressCheckout', {
    ...filters[10],
    featureKey: 'ExpressCheckout',
  });
}
// Release the shared client resources once when the Node adapter process stops.
process.once('SIGTERM', () => {
  void client.close();
});
export const handle = createTogglyHandle({
  client,
  // These demo presets are not authentication. Real apps derive claims from their authenticated session.
  context: (event) => preset(event.url.searchParams.get('preset') !== 'non-matching'),
  // Only demo identity/groups/role are intentionally made public; private session claims stay server-side.
  clientContext: (_event, context) => ({
    identity: context.identity,
    groups: context.groups,
    claims: context.claims,
  }),
  // A Front-end App Key selects worker-evaluated definitions. Expose is a second
  // allowlist: only these keys may cross the server-load serialization boundary.
  // Error reporting is observational; a failed fetch still returns exposed defaults.
  frontend: {
    appKey: publicEnv.PUBLIC_TOGGLY_APP_KEY,
    environment: publicEnv.PUBLIC_TOGGLY_ENVIRONMENT ?? 'Production',
    expose: [...Object.keys(defaults), 'ExpressCheckout'],
    featureDefaults: defaults,
    onError: (error) => console.error('Frontend snapshot unavailable', error),
  },
});
