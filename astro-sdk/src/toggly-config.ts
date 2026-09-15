import { orders, presets, type PresetName } from './sample/catalog';

/**
 * Shared Toggly options for the Astro integration and request middleware.
 *
 * Why defaults exist: without an App Key the sample still teaches gates by
 * falling back to these booleans instead of crashing or inventing a network
 * response. Live definitions replace them once TOGGLY_APP_KEY is set.
 */
export function createTogglyOptions(
  appKey: string | undefined,
  environment = 'Production',
  betaAccessDefault = true,
) {
  return {
    appKey,
    environment,
    flagDefaults: {
      'new-dashboard': true,
      'api-v2': false,
      'enhanced-submit': true,
      'beta-access': betaAccessDefault,
      ExpressCheckout: false,
      'filter-always-on': true,
      'filter-percentage': false,
      'filter-targeting': false,
      'filter-user-claims': false,
      'filter-time-window': true,
      'filter-country': false,
      'filter-browser-family': false,
      'filter-browser-language': false,
      'filter-device-type': false,
      'filter-os': false,
      'filter-context-property': false,
    },
    // Feature.astro calls evaluateGate. Without enableVariants, evaluateGate
    // ignores flagDefaults (empty definitions map → always false). With
    // enableVariants, boolean defaults work, but entity context is ignored on
    // that path — Order VIP uses a separate non-variant client below.
    enableVariants: true,
    // Islands hydrate from the integration inject; keep live sockets off so
    // offline/placeholder runs stay deterministic.
    enableLiveUpdates: false,
    verifySignatures: true,
    enableUsageTracking: false,
    telemetryAttachProcessHandlers: false,
    usageFlushInterval: 0,
  };
}

/**
 * Map the current URL to a request-local evaluation context.
 *
 * Identity and claims are constructed per request for the middleware client.
 * They never mutate a process-wide singleton — that would leak one visitor's
 * targeting into the next request on SSR.
 */
export function createTogglyRequestContext(url: URL) {
  const presetName = (url.searchParams.get('preset') as PresetName | null) ?? null;
  const preset = presetName && presets[presetName] ? presets[presetName] : null;

  const identity =
    url.searchParams.get('identity') ?? preset?.identity ?? undefined;
  const role =
    url.searchParams.get('role') ?? preset?.claims.role ?? 'user';
  const orderKey =
    url.searchParams.get('order') ??
    (preset?.order === 'vip' ? orders.vip.Id : orders.standard.Id);

  return {
    identity,
    claims: { role },
    orderKey,
    presetName: presetName ?? (identity === 'alice' ? 'matching' : identity === 'bob' ? 'nonmatching' : null),
  };
}

export function orderEntity(orderKey: string) {
  const order =
    orderKey === orders.vip.Id || orderKey === 'vip' ? orders.vip : orders.standard;
  // Canonical entity shape for getFlag / Feature context — Id is the key.
  return {
    kind: 'Order',
    key: order.Id,
    attributes: { Vip: order.Vip, Total: order.Total },
  };
}
