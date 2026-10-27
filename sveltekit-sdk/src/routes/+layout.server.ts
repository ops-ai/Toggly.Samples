import { loadToggly } from '@ops-ai/toggly-sveltekit/server';
import { TOGGLY_APP_KEY } from '$app/env/private';
import { PUBLIC_TOGGLY_APP_KEY } from '$app/env/public';

import {
  PUBLIC_TOGGLY_APP_KEY,
  PUBLIC_TOGGLY_ENVIRONMENT,
  PUBLIC_TOGGLY_ENABLE_TELEMETRY,
} from '$app/env/public';

import { filters, preset, vip, standard } from '#lib/catalog.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  // Reading this query parameter makes SvelteKit rerun the layout when demo
  // identity changes. The hook has already bound that request's context.
  const matching = event.url.searchParams.get('preset') !== 'non-matching';
  const entity = matching ? vip : standard;
  const toggly = await loadToggly(event);
  // Keyless demos: raw filter rules stay on the Node client; seed booleans the
  // browser store can resolve (see @ops-ai/toggly-hooks-types resolveEvaluatedDefinition).
  if (!TOGGLY_APP_KEY || !PUBLIC_TOGGLY_APP_KEY) {
    for (const flag of filters) {
      toggly.definitions[flag.featureKey] = await event.locals.toggly.isEnabled(flag.featureKey, {
        entity,
      });
    }
  }

  return {
    // Serialize only the verified, allowlisted frontend snapshot. Returning
    // event.locals.toggly would expose an inappropriate server-only object.
    toggly,
    publicKey: PUBLIC_TOGGLY_APP_KEY ?? '',
    environment: PUBLIC_TOGGLY_ENVIRONMENT,
    telemetryEnabled: PUBLIC_TOGGLY_ENABLE_TELEMETRY !== 'false',
    offline: !TOGGLY_APP_KEY || !PUBLIC_TOGGLY_APP_KEY,
    matching,
    // This is public demo input for teaching, never private session data.
    context: preset(matching),
    // All eleven flags use the same request-bound evaluator. Supplying the
    // selected Order lets ContextProperty participate without a global mapper.
    matrix: await Promise.all(
      filters.map(async (flag) => ({
        key: flag.featureKey,
        enabled: await event.locals.toggly.isEnabled(flag.featureKey, {
          entity,
        }),
      })),
    ),
    // Evaluate the same flag twice with distinct entities. Flattening the flag
    // to a single boolean would lose the VIP/standard distinction.
    vipEnabled: await event.locals.toggly.isEnabled('ExpressCheckout', {
      entity: vip,
    }),
    standardEnabled: await event.locals.toggly.isEnabled('ExpressCheckout', {
      entity: standard,
    }),
  };
};
