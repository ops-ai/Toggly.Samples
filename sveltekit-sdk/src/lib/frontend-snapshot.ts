import { createTogglyClient } from '@ops-ai/toggly-sveltekit/server';
import { defaults, filters, preset, standard, vip } from './catalog.js';

/** Keys allowed across the server-load serialization boundary for the browser store. */
export const frontendExposeKeys = [
  ...Object.keys(defaults),
  'ExpressCheckout',
  ...filters.map((definition) => definition.featureKey),
];

/**
 * Build a keyless frontend snapshot with filter keys pre-evaluated to booleans
 * (same merge as +layout.server.ts) so the browser store matches the server matrix.
 */
export async function keylessFrontendSnapshot(matching: boolean) {
  const client = createTogglyClient();
  await client.init();
  for (const definition of filters) {
    client.state.definitions.set(definition.featureKey, definition);
  }
  client.state.definitions.set('ExpressCheckout', {
    ...filters[10],
    featureKey: 'ExpressCheckout',
  });
  const ctx = preset(matching);
  const entity = matching ? vip : standard;
  const definitions: Record<string, boolean> = { ...defaults };
  for (const flag of filters) {
    definitions[flag.featureKey] = await client.isFeatureOn(flag.featureKey, ctx, entity);
  }
  definitions.ExpressCheckout = await client.isFeatureOn('ExpressCheckout', ctx, entity);
  await client.close();
  return {
    definitions,
    context: {
      identity: ctx.identity,
      groups: ctx.groups,
      claims: ctx.claims,
    },
    expose: [...frontendExposeKeys],
    source: 'defaults' as const,
  };
}
