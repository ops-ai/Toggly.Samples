import { demoKeys, filters, orderGate } from "./catalog";
export const OFFLINE_ORIGIN = "https://offline.toggly.invalid";
export const fixtureState = {
  toggles: Object.fromEntries(demoKeys.map((k) => [k, true])),
  fail: false,
};
export function installOfflineTransport() {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== OFFLINE_ORIGIN) return original(input, init);
    if (fixtureState.fail) throw new Error("Simulated offline fixture failure");
    const matching =
      (url.searchParams.get("u") || url.searchParams.get("userId")) === "alice";
    // Recorded HTTP outcomes teach the matrix; they do not implement the real
    // filter engine or sticky rollout hash. Entity rules remain actual SDK data.
    const flags = {
      ...Object.fromEntries(
        filters.map((f) => [
          f.key,
          f.key === "filter-always-on" ||
            f.key === "filter-time-window" ||
            matching,
        ]),
      ),
      ...fixtureState.toggles,
    };
    const body = url.pathname.includes("variants")
      ? Object.fromEntries(
          Object.entries(flags).map(([key, enabled]) => [
            key,
            {
              enabled,
              variant: matching ? "compact" : "comfortable",
              configurationValue: {
                density: matching ? "compact" : "comfortable",
              },
            },
          ]),
        )
      : {
          ...flags,
          ExpressCheckout: orderGate,
          "filter-context-property": orderGate,
        };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return () => {
    globalThis.fetch = original;
  };
}
