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
  definitionsBaseUri?: string,
  metricsBaseUrl?: string,
) {
  return {
    appKey,
    environment,
    ...(definitionsBaseUri ? { baseURI: definitionsBaseUri } : {}),
    ...(metricsBaseUrl ? { metricsBaseUrl } : {}),
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
    // Live sockets only when an App Key is present. Offline/placeholder CI
    // stays deterministic (no WebSocket); Home still subscribes to `$flags`
    // so programmatic refreshFlags / store updates refresh the UI.
    enableLiveUpdates: Boolean(appKey),
    verifySignatures: true,
    enableUsageTracking: false,
    enableMetrics: false,
    telemetryAttachProcessHandlers: false,
    usageFlushInterval: 0,
  };
}

type HeaderSource = Headers | { get(name: string): string | null | undefined };

type CookieSource =
  | { get(name: string): { value: string } | string | undefined }
  | undefined;

export type TogglyRequestSource = {
  headers?: HeaderSource;
  cookies?: CookieSource;
};

function readHeader(source: HeaderSource | undefined, name: string) {
  if (!source) return undefined;
  const value = source.get(name);
  return value && value.trim() !== '' ? value.trim() : undefined;
}

function readCookie(source: CookieSource | undefined, name: string) {
  if (!source) return undefined;
  const entry = source.get(name);
  if (!entry) return undefined;
  if (typeof entry === 'string') return entry.trim() !== '' ? entry.trim() : undefined;
  const value = entry.value;
  return value && value.trim() !== '' ? value.trim() : undefined;
}

function normalizePreset(raw: string | null | undefined): PresetName | null {
  if (!raw) return null;
  if (raw === 'matching') return 'matching';
  if (raw === 'nonmatching' || raw === 'non-matching') return 'nonmatching';
  return null;
}

function nonEmpty(value: string | null | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Parse document.cookie in the browser (Live E2E may persist preset without query). */
export function parseDocumentCookies(): CookieSource {
  if (typeof document === 'undefined') return undefined;
  const jar = new Map<string, string>();
  for (const part of document.cookie.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) continue;
    try {
      jar.set(rawKey, decodeURIComponent(rest.join('=')));
    } catch {
      jar.set(rawKey, rest.join('='));
    }
  }
  return {
    get(name: string) {
      const value = jar.get(name);
      return value === undefined ? undefined : { value };
    },
  };
}

/**
 * Map the current URL (and optional request cookies/headers) to evaluation context.
 *
 * Identity and claims are constructed per request for the middleware client.
 * They never mutate a process-wide singleton — that would leak one visitor's
 * targeting into the next request on SSR.
 */
export function createTogglyRequestContext(
  url: URL,
  source?: TogglyRequestSource,
) {
  const identityOverride =
    nonEmpty(url.searchParams.get('identity')) ??
    readHeader(source?.headers, 'x-toggly-identity') ??
    readCookie(source?.cookies, 'demo-identity');

  const roleOverride =
    nonEmpty(url.searchParams.get('role')) ?? readHeader(source?.headers, 'x-demo-role');

  const orderOverride =
    nonEmpty(url.searchParams.get('order')) ?? readHeader(source?.headers, 'x-demo-order');

  const presetName =
    normalizePreset(url.searchParams.get('preset')) ??
    normalizePreset(readHeader(source?.headers, 'x-demo-preset')) ??
    normalizePreset(readCookie(source?.cookies, 'sample-preset')) ??
    normalizePreset(readCookie(source?.cookies, 'toggly-preset'));

  if (!presetName) {
    return {
      identity: identityOverride ?? undefined,
      claims: { role: roleOverride ?? 'user' },
      orderKey:
        orderOverride === 'vip' || orderOverride === orders.vip.Id
          ? orders.vip.Id
          : orderOverride ?? orders.standard.Id,
      presetName: 'anonymous',
    };
  }

  const preset = presets[presetName];

  const identity = identityOverride ?? preset.identity;

  const role = roleOverride ?? preset.claims.role ?? 'user';

  const orderKey =
    orderOverride ??
    (preset.order === 'vip' ? orders.vip.Id : orders.standard.Id);

  return {
    identity,
    claims: { role },
    orderKey,
    presetName,
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
