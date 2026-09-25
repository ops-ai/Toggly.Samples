import { derived, get, writable } from "svelte/store";
import {
  Toggly,
  getTogglyService,
  isFeatureOn,
  recordUsage,
  recordView,
  incrementCounter,
  setGauge,
  flushTelemetry as flushMainTelemetry,
  togglyFlagsStore,
} from "@ops-ai/svelte-feature-flags-toggly";
import { allKeys, demoKeys, orders, users, targeting } from "./catalog";
import { OFFLINE_ORIGIN, installOfflineTransport } from "./offline";

export const workshopKey = "svelte-flag-workshop";

export function createWorkshop(env = import.meta.env) {
  const appKey = (env.VITE_TOGGLY_APP_KEY || "").trim();
  const offline = !appKey;
  const telemetryEnabled =
    !offline && env.VITE_TOGGLY_ENABLE_TELEMETRY !== "false";
  const metricsBaseUrl = (env.VITE_TOGGLY_METRICS_BASE_URL || "").trim();
  const session = writable({
    offline,
    telemetryEnabled,
    ready: false,
    busy: false,
    error: "",
    preset: "matching",
    user: users.matching,
    order: orders.vip,
    toggles: Object.fromEntries(demoKeys.map((k) => [k, true])),
    localAllowed: true,
    simulateError: false,
    snapshot: {},
    checkResult: "No action yet",
    telemetrySelection: null,
  });
  const actionStatus = writable("");
  const stopTransport = offline
    ? installOfflineTransport(() => get(session))
    : () => {};
  const defaults = Object.fromEntries(allKeys.map((k) => [k, false]));
  const options = {
    appKey: appKey || undefined,
    environment: env.VITE_TOGGLY_ENVIRONMENT || "Production",
    enableTelemetry: telemetryEnabled,
    ...(metricsBaseUrl ? { metricsBaseUrl } : {}),
    // Known targeting is supplied before the first evaluation. Later preset
    // clicks call setContext; this SPA never treats that as request-scoped
    // server identity.
    ...targeting(users.matching),
    persistCache: false,
    verifySignatures: !offline,
    enableLiveUpdates: !offline,
    featureDefaults: defaults,
    ...(offline ? { baseURI: OFFLINE_ORIGIN, verifySignatures: false } : {}),
    onError: (message) => {
      session.update((s) => {
        s.error = message;
        return s;
      });
    },
  };
  // Evaluated variants use a different endpoint than entity-gate payloads.
  // createToggly is a process-wide store owner, so the main client stays on
  // /evaluated-signed. A second Toggly instance requests variants.
  const variantService = new Toggly({
    ...options,
    enableVariants: true,
  });
  const variantTick = writable(0);
  const dashboardVariant = derived(variantTick, () =>
    variantService.getVariant("new-dashboard"),
  );
  const dashboardVariantValue = derived(variantTick, () =>
    variantService.getVariantValue("new-dashboard"),
  );
  let service;
  let stopFlags = () => {};
  let stopLocal = () => {};
  let disposed = false;
  let snapshotRevision = 0;
  let telemetryGeneration = 0;
  function bumpVariant() {
    variantTick.update((n) => n + 1);
  }
  async function snapshot() {
    if (disposed || !service) return;
    const revision = ++snapshotRevision;
    const current = get(session);
    const order = current.order;
    const user = current.user;
    const values = Object.fromEntries(
      await Promise.all(
        allKeys.map(async (key) => [
          key,
          await service.isFeatureOn(key, order, "Order"),
        ]),
      ),
    );
    const latest = get(session);
    // A slower check must not publish results for an older user or Order.
    // Flag-store listeners only read the SDK; they never request another fetch.
    if (
      !disposed &&
      revision === snapshotRevision &&
      order === latest.order &&
      user === latest.user
    ) {
      session.update((s) => {
        s.snapshot = values;
        return s;
      });
    }
  }
  function invalidateTelemetrySelection() {
    const generation = ++telemetryGeneration;
    session.update((s) => {
      s.telemetrySelection = null;
      return s;
    });
    return generation;
  }
  function currentTelemetrySelection() {
    const current = get(session);
    const selection = current.telemetrySelection;
    return selection &&
      selection.generation === telemetryGeneration &&
      selection.context === current.user.identity
      ? selection
      : null;
  }
  async function resolveTelemetrySelection(generation, context) {
    let enabled;
    let variant;
    try {
      enabled = await service.isFeatureOn("new-dashboard");
      if (enabled) {
        const assignment = variantService.getVariant("new-dashboard");
        variant = assignment?.name || "enabled";
      } else {
        // The main client's decision owns explicit events recorded on it.
        // A separate variant client may still hold an older assignment.
        variant = "disabled";
      }
    } catch (error) {
      if (
        !disposed &&
        generation === telemetryGeneration &&
        context === get(session).user.identity
      ) {
        actionStatus.set(
          `Feature check failed; usage and view stay disabled: ${String(error)}`,
        );
      }
      return false;
    }
    if (
      disposed ||
      generation !== telemetryGeneration ||
      context !== get(session).user.identity
    )
      return false;
    session.update((s) => {
      s.telemetrySelection = Object.freeze({
        generation,
        context,
        enabled,
        variant,
      });
      return s;
    });
    return true;
  }
  async function refreshFromSdk() {
    // setContext notifies the flags store before its network request finishes.
    // Do not infer a settled telemetry selection from that intermediate snapshot.
    if (get(session).busy) {
      await snapshot();
      bumpVariant();
      return;
    }
    const generation = invalidateTelemetrySelection();
    const context = get(session).user.identity;
    try {
      await snapshot();
      bumpVariant();
      await resolveTelemetrySelection(generation, context);
    } catch (error) {
      if (!disposed) {
        session.update((s) => {
          s.error = String(error);
          return s;
        });
      }
    }
  }
  async function updateContext() {
    ++snapshotRevision;
    const generation = invalidateTelemetrySelection();
    const context = get(session).user.identity;
    session.update((s) => {
      s.busy = true;
      s.error = "";
      return s;
    });
    let contextSettled = false;
    try {
      // setContext already refreshes. A second refresh would duplicate work.
      await Promise.all([
        service.setContext(targeting(get(session).user)),
        variantService.setContext(targeting(get(session).user)),
      ]);
      await snapshot();
      bumpVariant();
      contextSettled = true;
    } catch (error) {
      session.update((s) => {
        s.error = String(error);
        return s;
      });
    } finally {
      if (contextSettled) await resolveTelemetrySelection(generation, context);
      session.update((s) => {
        s.ready = true;
        s.busy = false;
        return s;
      });
    }
  }
  return {
    session,
    actionStatus,
    get state() {
      return get(session);
    },
    get mainService() {
      return service;
    },
    options,
    variantService,
    dashboardVariant,
    dashboardVariantValue,
    async attach() {
      service = getTogglyService();
      stopFlags();
      // Native flags store is how live/WebSocket reloads reach this checklist.
      stopFlags = togglyFlagsStore.subscribe(() => void refreshFromSdk());
      stopLocal();
      stopLocal = service.subscribeLocalGatesChanged(() => void snapshot());
      service.registerContext("Order", (order) => ({
        kind: "Order",
        key: order.Id,
        attributes: { Vip: order.Vip, Total: order.Total },
      }));
      service.setLocalGates([
        {
          id: "device-ready",
          flagKeys: ["enhanced-submit"],
          isEnabled: () => get(session).localAllowed,
        },
      ]);
      variantService.onVariantsUpdated = bumpVariant;
      await variantService.refreshFlags();
      bumpVariant();
      if (!offline) variantService.startWebSocket();
      if (offline) await updateContext();
      else {
        const generation = invalidateTelemetrySelection();
        const context = get(session).user.identity;
        await Promise.all([
          snapshot(),
          variantService.isFeatureOn("new-dashboard"),
        ]);
        bumpVariant();
        await resolveTelemetrySelection(generation, context);
        session.update((s) => {
          s.ready = true;
          return s;
        });
      }
    },
    async preset(name) {
      session.update((s) => {
        s.preset = name;
        s.user = users[name];
        s.order = name === "matching" ? orders.vip : orders.standard;
        return s;
      });
      await updateContext();
    },
    async order(name) {
      session.update((s) => {
        s.order = orders[name];
        return s;
      });
      await snapshot();
    },
    async toggle(key) {
      if (!offline) return;
      session.update((s) => {
        s.toggles[key] = !s.toggles[key];
        return s;
      });
      await updateContext();
    },
    async local() {
      session.update((s) => {
        s.localAllowed = !s.localAllowed;
        return s;
      });
      service.notifyLocalGatesChanged();
      await snapshot();
    },
    async failure() {
      if (!offline) return;
      session.update((s) => {
        s.simulateError = !s.simulateError;
        return s;
      });
      await updateContext();
    },
    async check() {
      const allowed = await isFeatureOn("enhanced-submit");
      const checkResult = allowed
        ? "Action allowed: ready to submit (demo only)"
        : "Action denied: keep the existing workflow";
      session.update((s) => {
        s.checkResult = checkResult;
        return s;
      });
      return checkResult;
    },
    async evaluateTelemetryFlag() {
      const generation = invalidateTelemetrySelection();
      const selected = await resolveTelemetrySelection(
        generation,
        get(session).user.identity,
      );
      if (selected) {
        actionStatus.set(
          "The SDK captures this feature check automatically when telemetry is enabled.",
        );
      }
    },
    recordTelemetryUsage() {
      const selection = currentTelemetrySelection();
      if (!telemetryEnabled || !selection) return;
      recordUsage("new-dashboard", selection.variant);
      actionStatus.set("Usage event added to the SDK telemetry batch.");
    },
    recordTelemetryView() {
      const selection = currentTelemetrySelection();
      if (!telemetryEnabled || !selection) return;
      recordView("new-dashboard", selection.variant);
      actionStatus.set("View event added to the SDK telemetry batch.");
    },
    incrementSampleActions() {
      if (!telemetryEnabled) return;
      incrementCounter("sample-actions", 1);
      actionStatus.set("Counter event added to the SDK telemetry batch.");
    },
    setSampleCartSize() {
      if (!telemetryEnabled) return;
      setGauge("sample-cart-size", 3);
      actionStatus.set("Gauge event added to the SDK telemetry batch.");
    },
    async flushTelemetry() {
      if (!telemetryEnabled) return;
      try {
        await Promise.all([
          flushMainTelemetry(),
          variantService.flushTelemetry(),
        ]);
        actionStatus.set(
          "Flush completed on both client instances; delivery is best effort.",
        );
      } catch {
        actionStatus.set("Flush could not be completed.");
      }
    },
    // This is a UI navigation exercise, not an authorization boundary. Backend
    // authorization must still protect every real protected action.
    async enterBeta() {
      return isFeatureOn("beta-access");
    },
    dispose() {
      disposed = true;
      ++snapshotRevision;
      invalidateTelemetrySelection();
      stopFlags();
      stopLocal();
      stopTransport();
      variantService.onVariantsUpdated = null;
      variantService.dispose();
    },
  };
}
