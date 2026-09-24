import { ITogglyOptions } from "@ops-ai/ngx-feature-flags-toggly";
import { publicConfig } from "../../generated-config";
import { allKeys, users } from "./catalog";
import { OFFLINE_ORIGIN } from "./offline";
export const offline = !publicConfig.appKey;
export const telemetryEnabled =
  !offline && publicConfig.enableTelemetry !== false;
export function togglyOptions(variants = false): ITogglyOptions {
  return {
    ...publicConfig,
    appKey: publicConfig.appKey || undefined,
    enableTelemetry: telemetryEnabled,
    ...users.matching,
    groups: [...users.matching.groups],
    claims: { ...users.matching.claims },
    persistCache: false,
    verifySignatures: !offline,
    enableVariants: variants,
    featureDefaults: Object.fromEntries(allKeys.map((k) => [k, false])),
    // customDefinitionsUrl is a real native API. Only no-key mode uses this
    // reserved origin, intercepted before any service is constructed in main.ts.
    ...(offline
      ? {
          customDefinitionsUrl:
            OFFLINE_ORIGIN + (variants ? "/variants" : "/flags"),
        }
      : {}),
  };
}
