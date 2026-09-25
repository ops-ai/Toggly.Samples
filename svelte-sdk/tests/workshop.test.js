import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import {
  Toggly,
  createToggly,
  togglyServiceStore,
} from "@ops-ai/svelte-feature-flags-toggly";
import App from "../src/App.svelte";
import { createWorkshop } from "../src/sample/workshop";
import { orderGate } from "../src/sample/catalog";

let workshop;
let wrapper;
const stubbedSocketUrls = [];

afterEach(() => {
  wrapper?.unmount();
  cleanup();
  workshop?.dispose();
  togglyServiceStore.set(null);
  wrapper = undefined;
  workshop = undefined;
  stubbedSocketUrls.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubLiveUpdateWebSocket() {
  // Match tests/browser.mjs: live-update sockets stay on the shipped path,
  // but must not contact a real endpoint with the test-only App Key.
  stubbedSocketUrls.length = 0;
  vi.stubGlobal(
    "WebSocket",
    class {
      readyState = 0;
      constructor(url) {
        stubbedSocketUrls.push(String(url ?? ""));
      }
      close() {}
      send() {}
      addEventListener() {}
    },
  );
}

async function mountWorkshop(env = {}) {
  if ((env.VITE_TOGGLY_APP_KEY || "").trim()) stubLiveUpdateWebSocket();
  workshop = createWorkshop(env);
  await createToggly(workshop.options);
  await workshop.attach();
  wrapper = render(App, { props: { workshop } });
  await waitFor(() => expect(workshop.state.ready).toBe(true));
  if (workshop.state.offline) {
    await waitFor(() => expect(wrapper.getByTestId("new-ui")).toBeTruthy());
  }
  return wrapper;
}

describe("real published Svelte createToggly and native surfaces", () => {
  it("keeps keyless telemetry silent and attaches to the createToggly-owned service", async () => {
    const w = await mountWorkshop();
    expect(workshop.mainService).toBeTruthy();
    expect(workshop.state.telemetryEnabled).toBe(false);
    expect(workshop.options.enableTelemetry).toBe(false);
    expect(w.getByTestId("telemetry-status").textContent).toMatch(
      /offline.*silent/i,
    );
    for (const testId of [
      "telemetry-usage",
      "telemetry-view",
      "telemetry-counter",
      "telemetry-gauge",
      "telemetry-flush",
    ])
      expect(w.getByTestId(testId).disabled).toBe(true);

    await workshop.evaluateTelemetryFlag();
    expect(workshop.state.telemetrySelection).toMatchObject({
      context: "alice",
      enabled: true,
      variant: "compact",
    });
    const usage = vi.spyOn(workshop.mainService, "recordUsage");
    const checks = vi.spyOn(workshop.mainService, "isFeatureOn");
    workshop.recordTelemetryUsage();
    workshop.recordTelemetryView();
    workshop.incrementSampleActions();
    workshop.setSampleCartSize();
    await workshop.flushTelemetry();
    expect(checks).not.toHaveBeenCalled();
    expect(usage).not.toHaveBeenCalled();

    const optedOut = createWorkshop({
      VITE_TOGGLY_APP_KEY: "test-only-not-a-real-key",
      VITE_TOGGLY_ENABLE_TELEMETRY: "false",
    });
    expect(optedOut.state.telemetryEnabled).toBe(false);
    expect(optedOut.options.enableTelemetry).toBe(false);
    optedOut.dispose();
  });

  it("keeps explicit events invalid after a failed identity refresh", async () => {
    const w = await mountWorkshop();
    await workshop.evaluateTelemetryFlag();
    expect(workshop.state.telemetrySelection?.context).toBe("alice");
    const usage = vi.spyOn(workshop.mainService, "recordUsage");
    vi.spyOn(workshop.mainService, "setContext").mockRejectedValue(
      new Error("simulated refresh failure"),
    );

    await workshop.preset("nonmatching");
    expect(workshop.state.user.identity).toBe("bob");
    expect(workshop.state.telemetrySelection).toBeNull();
    workshop.recordTelemetryUsage();
    workshop.recordTelemetryView();
    expect(usage).not.toHaveBeenCalled();
    expect(w.getByTestId("telemetry-usage").disabled).toBe(true);
    expect(w.getByTestId("telemetry-view").disabled).toBe(true);
  });

  it("uses the main client's disabled decision when the variant client retains an assignment", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ "new-dashboard": true, "api-v2": true }), {
        status: 200,
      }),
    );
    await mountWorkshop({
      VITE_TOGGLY_APP_KEY: "test-only-not-a-real-key",
      VITE_TOGGLY_METRICS_BASE_URL: "https://telemetry.test.invalid",
    });
    expect(stubbedSocketUrls).toHaveLength(2);
    expect(stubbedSocketUrls.every((url) => url.includes("/ws?"))).toBe(true);
    const main = workshop.mainService;
    const evaluate = vi.spyOn(main, "isFeatureOn").mockResolvedValue(false);
    const assignment = vi
      .spyOn(workshop.variantService, "getVariant")
      .mockReturnValue({ name: "compact" });
    const usage = vi.spyOn(main, "recordUsage");
    const view = vi.spyOn(main, "recordView");

    await workshop.evaluateTelemetryFlag();
    expect(workshop.state.telemetrySelection).toMatchObject({
      context: "alice",
      enabled: false,
      variant: "disabled",
    });
    workshop.recordTelemetryUsage();
    workshop.recordTelemetryView();

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(assignment).not.toHaveBeenCalled();
    expect(usage).toHaveBeenCalledExactlyOnceWith("new-dashboard", "disabled");
    expect(view).toHaveBeenCalledExactlyOnceWith("new-dashboard", "disabled");
  });

  it("starts without a key, renders native Feature, builder, stores and all eleven filters", async () => {
    const w = await mountWorkshop();
    expect(w.getByTestId("missing-key").textContent).toContain("No App Key");
    expect(w.getByTestId("new-ui").textContent).toContain("New dashboard");
    expect(w.getByTestId("composable").textContent).toBe("ON");
    expect(w.getByTestId("builder-button").disabled).toBe(false);
    expect(w.container.querySelectorAll("tbody tr")).toHaveLength(11);
    expect(w.getByTestId("variant-name").textContent).toBe("compact");
  });

  it("follows native background refresh in the checklist and matrix without another fetch, then unsubscribes", async () => {
    const w = await mountWorkshop();
    let fetches = 0;
    const inner = globalThis.fetch.bind(globalThis);
    const counting = (...args) => {
      fetches += 1;
      return inner(...args);
    };
    globalThis.fetch = counting;
    if (typeof window !== "undefined") window.fetch = counting;
    // Change the fixture without using workshop.toggle. setContext is the same
    // public refresh the WebSocket path uses; the checklist must follow the store.
    workshop.session.update((s) => {
      s.toggles["new-dashboard"] = false;
      return s;
    });
    await workshop.mainService.setContext({
      identity: "alice",
      groups: ["beta"],
      claims: { role: "admin" },
    });
    await waitFor(() => {
      expect(w.queryByTestId("new-ui")).toBeNull();
      expect(w.getByTestId("toggle-new-dashboard").textContent).toContain(
        "OFF",
      );
      expect(workshop.state.snapshot["new-dashboard"]).toBe(false);
      expect(workshop.state.snapshot["filter-always-on"]).toBe(true);
    });
    expect(fetches).toBe(1);
    expect(w.container.querySelectorAll("tbody tr")[0].textContent).toContain(
      "ON",
    );

    w.unmount();
    wrapper = undefined;
    const checks = vi.spyOn(workshop.mainService, "isFeatureOn");
    workshop.dispose();
    try {
      await workshop.mainService.setContext({ identity: "alice" });
    } catch {
      // Transport is restored on dispose; a failed refresh must not snapshot.
    }
    expect(checks).not.toHaveBeenCalled();
  });

  it("does not publish delayed snapshot checks after a newer Order/user or disposal", async () => {
    workshop = createWorkshop({});
    await createToggly(workshop.options);
    await workshop.attach();
    const service = workshop.mainService;
    const evaluate = service.isFeatureOn.bind(service);
    let pending = [];
    const checks = vi
      .spyOn(service, "isFeatureOn")
      .mockImplementation(async (...args) => {
        const value = await evaluate(...args);
        await new Promise((resolve) => pending.push(resolve));
        return value;
      });
    const oldOrder = workshop.order("vip");
    await waitFor(() => expect(pending.length).toBeGreaterThan(0));
    checks.mockImplementation(evaluate);
    await workshop.preset("nonmatching");
    pending.splice(0).forEach((resolve) => resolve());
    await oldOrder;
    expect(workshop.state.snapshot.ExpressCheckout).toBe(false);
    expect(workshop.state.snapshot["filter-targeting"]).toBe(false);

    checks.mockImplementation(async (...args) => {
      const value = await evaluate(...args);
      await new Promise((resolve) => pending.push(resolve));
      return value;
    });
    const lateOrder = workshop.order("vip");
    await waitFor(() => expect(pending.length).toBeGreaterThan(0));
    const beforeDispose = workshop.state.snapshot;
    workshop.dispose();
    pending.splice(0).forEach((resolve) => resolve());
    await lateOrder;
    expect(workshop.state.snapshot).toBe(beforeDispose);
  });

  it("updates native negate and any/all gates, then denies the actual service action", async () => {
    const w = await mountWorkshop();
    await workshop.toggle("new-dashboard");
    await waitFor(() => {
      expect(w.queryByTestId("new-ui")).toBeNull();
      expect(w.getByTestId("old-ui")).toBeTruthy();
      expect(w.queryByTestId("all-on")).toBeNull();
      expect(w.getByTestId("any-on")).toBeTruthy();
    });
    await workshop.toggle("enhanced-submit");
    await workshop.check();
    await waitFor(() => {
      expect(w.getByTestId("action-result").textContent).toContain(
        "Action denied",
      );
    });
  });

  it("changes entity values per check without changing the session user", async () => {
    const w = await mountWorkshop();
    expect(w.getByTestId("vip-checkout")).toBeTruthy();
    await workshop.order("standard");
    await waitFor(() => {
      expect(w.queryByTestId("vip-checkout")).toBeNull();
      expect(w.getByTestId("order-result").textContent).toBe("OFF");
    });
    expect(workshop.state.user.identity).toBe("alice");
    expect(await workshop.mainService.isFeatureOn("ExpressCheckout")).toBe(
      false,
    );
  });

  it("refreshes identity exactly once per actual service and updates variants", async () => {
    const w = await mountWorkshop();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await workshop.preset("nonmatching");
    await waitFor(() => {
      expect(w.getByTestId("variant-name").textContent).toBe("comfortable");
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    for (const [input] of fetchSpy.mock.calls) {
      const url = new URL(input);
      expect(
        url.searchParams.get(
          url.pathname.includes("variants") ? "userId" : "u",
        ),
      ).toBe("bob");
      expect(url.searchParams.get("claim.role")).toBe("user");
    }
    expect(workshop.state.snapshot["filter-targeting"]).toBe(false);
    expect(workshop.state.snapshot["filter-always-on"]).toBe(true);
  });

  it("ANDs a local prerequisite with remote values and denies navigation", async () => {
    const w = await mountWorkshop();
    await workshop.local();
    await waitFor(() => {
      expect(w.getByTestId("builder-button").disabled).toBe(true);
    });
    await workshop.toggle("enhanced-submit");
    await workshop.local();
    expect(await workshop.mainService.isFeatureOn("enhanced-submit")).toBe(
      false,
    );
    await workshop.toggle("beta-access");
    await w.getByTestId("beta-route").click();
    await waitFor(() => {
      expect(w.getByTestId("route-result").textContent).toContain("denied");
    });
  });

  it("shows errors, denies defaults and recovers through real SDK refresh", async () => {
    const w = await mountWorkshop();
    await workshop.failure();
    await waitFor(() => {
      expect(w.getByRole("alert").textContent).toContain(
        "simulated transport failure",
      );
      expect(workshop.state.snapshot["new-dashboard"]).toBe(false);
    });
    await workshop.failure();
    await waitFor(() => {
      expect(w.queryByRole("alert")).toBeNull();
      expect(w.getByTestId("new-ui")).toBeTruthy();
    });
  });
});

it("native service enforces missing/false entity gates and unknown defaults without wrappers", async () => {
  const service = new Toggly({
    featureDefaults: { checkout: orderGate },
    persistCache: false,
    enableLiveUpdates: false,
  });
  expect(await service.isFeatureOn("checkout")).toBe(false);
  expect(
    await service.isFeatureOn("checkout", {
      kind: "Order",
      key: "standard",
      attributes: { Vip: false },
    }),
  ).toBe(false);
  expect(
    await service.isFeatureOn("checkout", {
      kind: "Order",
      key: "vip",
      attributes: { Vip: true },
    }),
  ).toBe(true);
  expect(await service.isFeatureOn("unknown")).toBe(false);
  service.stopWebSocket();
});
