import type { TogglyServer } from '@ops-ai/astro-feature-flags-toggly';

export function togglyDiagEnabled() {
  const runtime = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  const flag = runtime?.TOGGLY_LIVEE2E_DIAG ?? runtime?.LIVEE2E_DIAG;
  return flag === '1' || flag === 'true';
}

export function logTogglyDiag(
  scope: string,
  payload: Record<string, unknown>,
) {
  if (!togglyDiagEnabled()) return;
  console.error(
    `[toggly-livee2e-diag:${scope}] ${JSON.stringify(payload)}`,
  );
}

export async function diagFilterTargeting(
  scope: string,
  requestContext: {
    identity?: string;
    presetName?: string;
    claims?: { role?: string };
  },
  appKey: string | undefined,
  entityClient: TogglyServer,
  apiClient: TogglyServer,
) {
  if (!togglyDiagEnabled()) return;

  let entityValue: boolean | null = null;
  let apiValue: boolean | null = null;
  try {
    entityValue = await entityClient.getFlag('filter-targeting', false);
  } catch (error) {
    entityValue = null;
    logTogglyDiag(scope, {
      filterTargetingEntityError: String(error),
    });
  }
  try {
    apiValue = await apiClient.getFlag('filter-targeting', false);
  } catch (error) {
    apiValue = null;
    logTogglyDiag(scope, {
      filterTargetingApiError: String(error),
    });
  }

  logTogglyDiag(scope, {
    preset: requestContext.presetName,
    identity: requestContext.identity ?? null,
    role: requestContext.claims?.role ?? null,
    appKeyPresent: Boolean(appKey),
    appKeyLength: appKey?.length ?? 0,
    filterTargetingEntity: entityValue,
    filterTargetingApi: apiValue,
  });
}
