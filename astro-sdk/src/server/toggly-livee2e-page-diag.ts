/**
 * TEMPORARY Live E2E diagnostics — remove after filter-targeting root cause is found.
 * Rendered into the filter-targeting matrix row (data-livee2e-diag-temp) for Playwright snapshots.
 */

import type { TogglyServer } from '@ops-ai/astro-feature-flags-toggly';
import type { readTogglyRuntimeEnv } from './toggly-runtime-env';

const ENV_PREFIX =
  /^(TOGGLY_|LIVEE2E_|SAMPLE_|PORT|HOST|NODE_|SECRET_|VITE_TOGGLY_)/;

type EnvLen = { n: string; l: number };

function envVarLengths(): EnvLen[] {
  const runtime = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  const names = new Set<string>();
  if (runtime) {
    for (const key of Object.keys(runtime)) {
      if (ENV_PREFIX.test(key)) names.add(key);
    }
  }
  const meta = import.meta.env as Record<string, string | undefined>;
  for (const key of Object.keys(meta)) {
    if (key.includes('TOGGLY')) names.add(key);
  }
  return [...names]
    .sort()
    .map((name) => {
      const runtimeLen = runtime?.[name]?.length ?? 0;
      const metaLen =
        meta[name] !== undefined && meta[name] !== null
          ? String(meta[name]).length
          : 0;
      return { n: name, l: Math.max(runtimeLen, metaLen) };
    });
}

function definitionsUrl(
  baseURI: string | undefined,
  appKey: string | undefined,
  environment: string,
) {
  if (!appKey || !baseURI) return null;
  const base = baseURI.replace(/\/$/, '');
  return `${base}/definitions-signed/${appKey}/${environment}`;
}

function variantsUrl(
  baseURI: string | undefined,
  appKey: string | undefined,
  environment: string,
  identity: string | undefined,
  claims: Record<string, string | undefined>,
) {
  if (!appKey || !baseURI) return null;
  const base = baseURI.replace(/\/$/, '');
  const url = new URL(
    `${base}/evaluated-variants-signed/${appKey}/${environment}`,
  );
  if (identity) url.searchParams.set('userId', identity);
  if (claims.role) url.searchParams.set('claim.role', claims.role);
  return url.toString();
}

async function probeHttp(url: string | null) {
  if (!url) {
    return { host: null as string | null, status: null as number | null, err: 'no-url' };
  }
  try {
    const host = new URL(url).host;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const text = await response.text();
    return {
      host,
      status: response.status,
      bodyLen: text.length,
      hasFilterTargeting: text.includes('filter-targeting'),
    };
  } catch (error) {
    return {
      host: new URL(url).host,
      status: null,
      err: String(error),
    };
  }
}

function targetingMetaFromBody(text: string) {
  try {
    const parsed = JSON.parse(text) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === 'object' &&
          'definitions' in parsed &&
          Array.isArray((parsed as { definitions: unknown }).definitions)
        ? (parsed as { definitions: unknown[] }).definitions
        : null;
    if (!list) return { flagCount: 0, filterName: null, rollout: null, userSlots: 0 };
    const entry = list.find(
      (row) =>
        row &&
        typeof row === 'object' &&
        (row as { featureKey?: string }).featureKey === 'filter-targeting',
    ) as
      | {
          filters?: Array<{ name?: string; parameters?: Record<string, string> }>;
        }
      | undefined;
    const filters = entry?.filters ?? [];
    const targeting = filters.find((f) =>
      (f.name ?? '').replace(/^Microsoft\./, '').includes('Targeting'),
    );
    const params = targeting?.parameters ?? {};
    const userSlots = Object.keys(params).filter((k) =>
      k.startsWith('Audience.Users') || k.startsWith('Audience:Users'),
    ).length;
    const rollout =
      params['Audience.DefaultRolloutPercentage'] ??
      params['Audience:DefaultRolloutPercentage'] ??
      params.Percentage ??
      null;
    return {
      flagCount: list.length,
      filterName: targeting?.name ?? null,
      rollout,
      userSlots,
    };
  } catch {
    return { flagCount: 0, filterName: null, rollout: null, userSlots: 0 };
  }
}

export async function buildFilterTargetingPageDiag(input: {
  togglyEnv: ReturnType<typeof readTogglyRuntimeEnv>;
  verifySignatures: boolean;
  requestContext: {
    identity?: string;
    presetName?: string;
    claims?: { role?: string };
  };
  matrixValue: boolean;
  entityClient: TogglyServer;
  apiClient: TogglyServer;
}) {
  const { togglyEnv, requestContext, matrixValue } = input;
  const identity = requestContext.identity ?? '';
  const role = requestContext.claims?.role;

  let entityEval: boolean | null = null;
  let apiEval: boolean | null = null;
  try {
    entityEval = await input.entityClient.getFlag('filter-targeting', false);
  } catch (error) {
    entityEval = null;
  }
  try {
    apiEval = await input.apiClient.getFlag('filter-targeting', false);
  } catch (error) {
    apiEval = null;
  }

  const base =
    togglyEnv.definitionsBaseUri?.trim() || 'https://definitions.toggly.io';
  const defsUrl = definitionsUrl(
    base,
    togglyEnv.appKey,
    togglyEnv.environment,
  );
  const varUrl = variantsUrl(
    base,
    togglyEnv.appKey,
    togglyEnv.environment,
    identity || undefined,
    { role },
  );

  const defsProbe = await probeHttp(defsUrl);
  let defsMeta = {
    flagCount: 0,
    filterName: null as string | null,
    rollout: null as string | null,
    userSlots: 0,
  };
  if (defsUrl && defsProbe.status === 200) {
    try {
      const response = await fetch(defsUrl, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      defsMeta = targetingMetaFromBody(await response.text());
    } catch {
      /* ignore */
    }
  }

  const variantsProbe = await probeHttp(varUrl);

  const payload = {
    temp: 'LIVEE2E_DIAG_REMOVE',
    preset: requestContext.presetName,
    identity,
    role: role ?? null,
    matrix: matrixValue,
    evalEntity: entityEval,
    evalApi: apiEval,
    verifySignatures: input.verifySignatures,
    runtimeAppKeyLen: togglyEnv.appKey?.length ?? 0,
    importMetaAppKeyLen:
      import.meta.env.TOGGLY_APP_KEY !== undefined
        ? String(import.meta.env.TOGGLY_APP_KEY).length
        : 0,
    definitionsHost: defsProbe.host,
    definitionsStatus: defsProbe.status,
    definitionsHasFilterTargeting: defsProbe.hasFilterTargeting ?? false,
    definitionsFlagCount: defsMeta.flagCount,
    targetingFilter: defsMeta.filterName,
    targetingRollout: defsMeta.rollout,
    targetingUserSlots: defsMeta.userSlots,
    variantsHost: variantsProbe.host,
    variantsStatus: variantsProbe.status,
    env: envVarLengths(),
  };

  return JSON.stringify(payload);
}
