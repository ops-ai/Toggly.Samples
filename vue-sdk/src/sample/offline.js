import { demoKeys, filters, orderGate } from "./catalog";
export const OFFLINE_ORIGIN = "https://offline.toggly.invalid";

// This is a teaching fixture, NOT a reimplementation of Toggly's filters.
// Presets choose recorded outcomes; notably the illustrative percentage result
// is not the production bucketing algorithm. Real SDK gates consume the payload.
export function fixtureDefinitions(user, toggles) {
  const matching = user.identity === "alice";
  const defs = Object.fromEntries(
    demoKeys.map((key) => [key, toggles[key] ?? true]),
  );
  for (const { key } of filters) defs[key] = matching;
  defs["filter-always-on"] = true;
  defs["filter-time-window"] = true;
  defs["filter-percentage"] = matching;
  defs.ExpressCheckout = orderGate;
  defs["filter-context-property"] = orderGate;
  return defs;
}

// Only this reserved offline origin is intercepted. A configured live App Key
// never installs this transport. There are no fake keys or network fallbacks.
// Keep the real SDK between the fake transport and the components under test.
export function installOfflineTransport(readState, host = globalThis) {
  const original = host.fetch;
  host.fetch = async (input, options) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.origin !== OFFLINE_ORIGIN)
      return original.call(host, input, options);
    const { user, toggles, simulateError } = readState();
    if (simulateError)
      throw new Error("Offline exercise: simulated transport failure");
    const defs = fixtureDefinitions(user, toggles);
    const payload = url.pathname.includes("evaluated-variants-signed")
      ? {
          defs: {
            "new-dashboard": {
              enabled: Boolean(defs["new-dashboard"]),
              variant: user.identity === "alice" ? "compact" : "comfortable",
              configurationValue: {
                density: user.identity === "alice" ? "compact" : "comfortable",
              },
            },
          },
        }
      : defs;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return () => {
    host.fetch = original;
  };
}
