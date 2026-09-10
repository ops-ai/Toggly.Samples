import { reactive, readonly } from "vue";
import { Toggly } from "@ops-ai/vue-feature-flags-toggly";
import { allKeys, demoKeys, orders, users, targeting } from "./catalog";
import { OFFLINE_ORIGIN, installOfflineTransport } from "./offline";

export const workshopKey = Symbol("Vue flag workshop");
export function createWorkshop(env = import.meta.env) {
  const appKey = (env.VITE_TOGGLY_APP_KEY || "").trim();
  const offline = !appKey;
  const state = reactive({
    offline,
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
  });
  const stopTransport = offline
    ? installOfflineTransport(() => state)
    : () => {};
  const defaults = Object.fromEntries(allKeys.map((k) => [k, false]));
  const options = {
    appKey: appKey || undefined,
    environment: env.VITE_TOGGLY_ENVIRONMENT || "Production",
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
  async function snapshot() {
    state.snapshot = Object.fromEntries(
      await Promise.all(
        allKeys.map(async (key) => [
          key,
          await service.isFeatureOn(key, state.order, "Order"),
        ]),
      ),
    );
  }
  async function updateContext() {
    state.busy = true;
    state.error = "";
    try {
      // setContext already refreshes. A second refresh would duplicate work.
      await Promise.all([
        service.setContext(targeting(state.user)),
        variantService.setContext(targeting(state.user)),
      ]);
      await snapshot();
    } catch (error) {
      state.error = String(error);
    } finally {
      state.ready = true;
      state.busy = false;
    }
  }
  return {
    state: readonly(state),
    options,
    variantService,
    async attach(instance) {
      service = instance;
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
        await Promise.all([
          snapshot(),
          variantService.isFeatureOn("new-dashboard"),
        ]);
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
    // This is a UI navigation exercise, not an authorization boundary. Backend
    // authorization must still protect every real protected action.
    async enterBeta() {
      return service.isFeatureOn("beta-access");
    },
    dispose() {
      stopTransport();
      service?.stopWebSocket();
      variantService.stopWebSocket();
    },
  };
}
