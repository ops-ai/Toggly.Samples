import { reactive, readonly } from "vue";
import { Toggly } from "@ops-ai/vue-feature-flags-toggly";
import { allKeys, demoKeys, orders, users, targeting } from "./catalog";
import { OFFLINE_ORIGIN, installOfflineTransport } from "./offline";

export const workshopKey = Symbol("Vue flag workshop");
export function createWorkshop(env = import.meta.env) {
  const appKey = (env.VITE_TOGGLY_APP_KEY || "").trim();
  const offline = !appKey;
  const telemetryEnabled =
    !offline && env.VITE_TOGGLY_ENABLE_TELEMETRY !== "false";
  const metricsBaseUrl = (env.VITE_TOGGLY_METRICS_BASE_URL || "").trim();
  const state = reactive({
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
    telemetryActionStatus: "",
  });
  const stopTransport = offline
    ? installOfflineTransport(() => state)
    : () => {};
  const defaults = Object.fromEntries(allKeys.map((k) => [k, false]));
  const options = {
    appKey: appKey || undefined,
    environment: env.VITE_TOGGLY_ENVIRONMENT || "Production",
    enableTelemetry: telemetryEnabled,
    ...(metricsBaseUrl ? { metricsBaseUrl } : {}),
    ...targeting(state.user),
    // Cache-disabled workshop sessions avoid carrying one student's state to
    // another exercise. Live definitions retain signature verification.
    persistCache: false,
    verifySignatures: !offline,
    enableLiveUpdates: !offline,
    featureDefaults: defaults,
    ...(offline ? { baseURI: OFFLINE_ORIGIN, verifySignatures: false } : {}),
    onError: (message) => {
      state.error = message;
    },
  };
  // Evaluated variants are a different endpoint/payload than entity gates.
  // Use a separate SDK instance, rather than pretending its boolean snapshot
  // contains a full entity rule. Both clients receive the same user targeting.
  const variantService = new Toggly().init({
    ...options,
    enableVariants: true,
  });
  let service;
  let stopRefresh = () => {};
  let stopVariantRefresh = () => {};
  let disposed = false;
  let snapshotRevision = 0;
  let telemetryGeneration = 0;
  async function snapshot() {
    if (disposed) return;
    const revision = ++snapshotRevision;
    const order = state.order;
    const user = state.user;
    const values = Object.fromEntries(
      await Promise.all(
        allKeys.map(async (key) => [
          key,
          await service.isFeatureOn(key, order, "Order"),
        ]),
      ),
    );
    // A slower check must not publish results for an older user or Order.
    // Refresh listeners only read the SDK; they never request another fetch.
    if (
      !disposed &&
      revision === snapshotRevision &&
      order === state.order &&
      user === state.user
    ) {
      state.snapshot = values;
    }
  }
  function invalidateTelemetrySelection() {
    const generation = ++telemetryGeneration;
    state.telemetrySelection = null;
    return generation;
  }
  function currentTelemetrySelection() {
    const selection = state.telemetrySelection;
    return selection &&
      selection.generation === telemetryGeneration &&
      selection.context === state.user.identity
      ? selection
      : null;
  }
  async function resolveTelemetrySelection(generation, context) {
    let enabled;
    let variant;
    try {
      enabled = await service.isFeatureOn("new-dashboard");
      const assignment = variantService.getVariant("new-dashboard");
      variant = assignment?.name || (enabled ? "enabled" : "disabled");
    } catch (error) {
      if (
        !disposed &&
        generation === telemetryGeneration &&
        context === state.user.identity
      )
        state.telemetryActionStatus = `Feature check failed; usage and view stay disabled: ${String(error)}`;
      return false;
    }
    if (
      disposed ||
      generation !== telemetryGeneration ||
      context !== state.user.identity
    )
      return false;
    state.telemetrySelection = Object.freeze({
      generation,
      context,
      enabled,
      variant,
    });
    return true;
  }
  async function refreshFromSdk() {
    // setContext emits a refresh notification before its network request. Do
    // not infer a settled selection from the old/default snapshot during it.
    if (state.busy) {
      await snapshot();
      return;
    }
    const generation = invalidateTelemetrySelection();
    const context = state.user.identity;
    try {
      await snapshot();
      await resolveTelemetrySelection(generation, context);
    } catch (error) {
      if (!disposed) state.error = String(error);
    }
  }
  async function updateContext() {
    ++snapshotRevision;
    const generation = invalidateTelemetrySelection();
    const context = state.user.identity;
    state.busy = true;
    state.error = "";
    let contextSettled = false;
    try {
      // setContext already refreshes. A second refresh would duplicate work.
      await Promise.all([
        service.setContext(targeting(state.user)),
        variantService.setContext(targeting(state.user)),
      ]);
      await snapshot();
      contextSettled = true;
    } catch (error) {
      state.error = String(error);
    } finally {
      state.ready = true;
      if (contextSettled) await resolveTelemetrySelection(generation, context);
      state.busy = false;
    }
  }
  return {
    state: readonly(state),
    get mainService() {
      return service;
    },
    options,
    variantService,
    async attach(instance) {
      service = instance;
      stopRefresh();
      stopRefresh = service.subscribeFeaturesRefresh(() => void refreshFromSdk());
      stopVariantRefresh();
      stopVariantRefresh = variantService.subscribeFeaturesRefresh(() =>
        void refreshFromSdk(),
      );
      service.registerContext("Order", (order) => ({
        kind: "Order",
        key: order.Id,
        attributes: { Vip: order.Vip, Total: order.Total },
      }));
      service.setLocalGates([
        {
          id: "device-ready",
          flagKeys: ["enhanced-submit"],
          isEnabled: () => state.localAllowed,
        },
      ]);
      if (offline) await updateContext();
      else {
        const generation = invalidateTelemetrySelection();
        const context = state.user.identity;
        await Promise.all([
          snapshot(),
          variantService.isFeatureOn("new-dashboard"),
        ]);
        await resolveTelemetrySelection(generation, context);
        state.ready = true;
      }
    },
    async preset(name) {
      state.preset = name;
      state.user = users[name];
      state.order = name === "matching" ? orders.vip : orders.standard;
      await updateContext();
    },
    async order(name) {
      state.order = orders[name];
      await snapshot();
    },
    async toggle(key) {
      if (!offline) return;
      state.toggles[key] = !state.toggles[key];
      await updateContext();
    },
    async local() {
      state.localAllowed = !state.localAllowed;
      service.notifyLocalGatesChanged();
      await snapshot();
    },
    async failure() {
      if (!offline) return;
      state.simulateError = !state.simulateError;
      await updateContext();
    },
    async check() {
      state.checkResult = (await service.isFeatureOn("enhanced-submit"))
        ? "Action allowed: ready to submit (demo only)"
        : "Action denied: keep the existing workflow";
      return state.checkResult;
    },
    async evaluateTelemetryFlag() {
      const generation = invalidateTelemetrySelection();
      const selected = await resolveTelemetrySelection(
        generation,
        state.user.identity,
      );
      if (selected)
        state.telemetryActionStatus =
          "The SDK captures this feature check automatically when telemetry is enabled.";
    },
    recordTelemetryUsage() {
      const selection = currentTelemetrySelection();
      if (!telemetryEnabled || !selection) return;
      service.recordUsage("new-dashboard", selection.variant);
      state.telemetryActionStatus = "Usage event added to the SDK telemetry batch.";
    },
    recordTelemetryView() {
      const selection = currentTelemetrySelection();
      if (!telemetryEnabled || !selection) return;
      service.recordView("new-dashboard", selection.variant);
      state.telemetryActionStatus = "View event added to the SDK telemetry batch.";
    },
    incrementSampleActions() {
      if (!telemetryEnabled) return;
      service.incrementCounter("sample-actions", 1);
      state.telemetryActionStatus = "Counter event added to the SDK telemetry batch.";
    },
    setSampleCartSize() {
      if (!telemetryEnabled) return;
      service.setGauge("sample-cart-size", 3);
      state.telemetryActionStatus = "Gauge event added to the SDK telemetry batch.";
    },
    async flushTelemetry() {
      if (!telemetryEnabled) return;
      try {
        await Promise.all([
          service.flushTelemetry(),
          variantService.flushTelemetry(),
        ]);
        state.telemetryActionStatus =
          "Flush completed on both client instances; delivery is best effort.";
      } catch {
        state.telemetryActionStatus = "Flush could not be completed.";
      }
    },
    // This is a UI navigation exercise, not an authorization boundary. Backend
    // authorization must still protect every real protected action.
    async enterBeta() {
      return service.isFeatureOn("beta-access");
    },
    dispose() {
      disposed = true;
      ++snapshotRevision;
      invalidateTelemetrySelection();
      stopRefresh();
      stopVariantRefresh();
      stopTransport();
      // The plugin service is a module singleton shared by all Vue hosts; only
      // dispose the separately owned variants client here.
      variantService.dispose();
    },
  };
}
