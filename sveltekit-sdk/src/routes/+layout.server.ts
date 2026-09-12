import { loadToggly } from "@ops-ai/toggly-sveltekit/server";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { filters, preset, vip, standard } from "$lib/catalog";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async (event) => {
  // Reading this query parameter makes SvelteKit rerun the layout when demo
  // identity changes. The hook has already bound that request's context.
  const matching = event.url.searchParams.get("preset") !== "non-matching";
  const entity = matching ? vip : standard;

  return {
    // Serialize only the verified, allowlisted frontend snapshot. Returning
    // event.locals.toggly would expose an inappropriate server-only object.
    toggly: await loadToggly(event),
    publicKey: publicEnv.PUBLIC_TOGGLY_APP_KEY ?? "",
    environment: publicEnv.PUBLIC_TOGGLY_ENVIRONMENT ?? "Production",
    offline: !env.TOGGLY_APP_KEY || !publicEnv.PUBLIC_TOGGLY_APP_KEY,
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
    vipEnabled: await event.locals.toggly.isEnabled("ExpressCheckout", {
      entity: vip,
    }),
    standardEnabled: await event.locals.toggly.isEnabled("ExpressCheckout", {
      entity: standard,
    }),
  };
};
