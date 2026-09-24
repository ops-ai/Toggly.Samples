import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import {
  Toggly,
  toggly,
  togglyService,
} from "@ops-ai/vue-feature-flags-toggly";
import App from "../src/App.vue";
import { createWorkshop, workshopKey } from "../src/sample/workshop";
import { orderGate } from "../src/sample/catalog";
let workshop, wrapper;
afterEach(() => {
  wrapper?.unmount();
  workshop?.dispose();
  wrapper = undefined;
  workshop = undefined;
  vi.restoreAllMocks();
});
async function mountWorkshop(env = {}) {
  workshop = createWorkshop(env);
  wrapper = mount(App, {
    global: {
      plugins: [[toggly, workshop.options]],
      provide: { [workshopKey]: workshop },
    },
  });
  await flushPromises();
  return wrapper;
}
describe("real published Vue plugin and native surfaces", () => {
  it("keeps keyless telemetry silent and attaches to the app-owned plugin service", async () => {
    const w = await mountWorkshop();
    expect(workshop.mainService).not.toBe(togglyService);
    expect(workshop.state.telemetryEnabled).toBe(false);
    expect(workshop.options.enableTelemetry).toBe(false);
    expect(w.get('[data-testid="telemetry-status"]').text()).toMatch(
      /offline.*silent/i,
    );
    for (const testId of [
      "telemetry-usage",
      "telemetry-view",
      "telemetry-counter",
      "telemetry-gauge",
      "telemetry-flush",
    ])
      expect(w.get(`[data-testid="${testId}"]`).attributes("disabled")).toBeDefined();

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
    expect(w.get('[data-testid="telemetry-usage"]').attributes("disabled"))
      .toBeDefined();
    expect(w.get('[data-testid="telemetry-view"]').attributes("disabled"))
      .toBeDefined();
  });
  it("uses the main client's disabled decision when the variant client retains an assignment", async () => {
    await mountWorkshop({
      VITE_TOGGLY_APP_KEY: "test-only-not-a-real-key",
      VITE_TOGGLY_METRICS_BASE_URL: "https://telemetry.test.invalid",
    });
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
  it("starts without a key, renders native Feature, builder, composables and all eleven filters", async () => {
    const w = await mountWorkshop();
    expect(w.get('[data-testid="missing-key"]').text()).toContain("No App Key");
    expect(w.get('[data-testid="new-ui"]').text()).toContain("New dashboard");
    expect(w.get('[data-testid="composable"]').text()).toBe("ON");
    expect(
      w.get('[data-testid="builder-button"]').attributes("disabled"),
    ).toBeUndefined();
    expect(w.findAll("tbody tr")).toHaveLength(11);
    expect(w.get('[data-testid="variant-name"]').text()).toBe("compact");
  });
  it("follows native background refresh in the checklist and matrix without another fetch, then unsubscribes", async () => {
    const w = await mountWorkshop();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ "new-dashboard": false, "filter-always-on": false }),
          { status: 200 },
        ),
      );
    // This public SDK call emits the same refresh notification as a WebSocket
    // reload. No workshop toggle or context control copies the snapshot for us.
    await workshop.mainService.setContext({
      identity: "alice",
      groups: ["beta"],
      claims: { role: "admin" },
    });
    await flushPromises();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(w.find('[data-testid="new-ui"]').exists()).toBe(false);
    expect(w.get('[data-testid="toggle-new-dashboard"]').text()).toContain(
      "OFF",
    );
    expect(w.findAll("tbody tr")[0].text()).toContain("OFF");
    expect(workshop.state.snapshot["new-dashboard"]).toBe(false);

    w.unmount();
    wrapper = undefined;
    workshop.dispose();
    const checks = vi.spyOn(workshop.mainService, "isFeatureOn");
    await workshop.mainService.setContext({ identity: "alice" });
    await flushPromises();
    expect(checks).not.toHaveBeenCalled();
  });
  it("does not publish delayed snapshot checks after a newer Order/user or disposal", async () => {
    workshop = createWorkshop({});
    const service = new Toggly().init(workshop.options);
    await workshop.attach(service);
    const evaluate = service.isFeatureOn.bind(service);
    let pending = [];
    const checks = vi
      .spyOn(service, "isFeatureOn")
      .mockImplementation(async (...args) => {
        const value = await evaluate(...args); // preserve actual SDK evaluation
        await new Promise((resolve) => pending.push(resolve));
        return value;
      });
    // Delay the old VIP snapshot, then allow a newer standard Order to win.
    const oldOrder = workshop.order("vip");
    await flushPromises();
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
    await flushPromises();
    const beforeDispose = workshop.state.snapshot;
    workshop.dispose();
    pending.splice(0).forEach((resolve) => resolve());
    await lateOrder;
    expect(workshop.state.snapshot).toBe(beforeDispose);
  });
  it("updates native negate and any/all gates, then denies the actual service action", async () => {
    const w = await mountWorkshop();
    await workshop.toggle("new-dashboard");
    await flushPromises();
    expect(w.find('[data-testid="new-ui"]').exists()).toBe(false);
    expect(w.find('[data-testid="old-ui"]').exists()).toBe(true);
    expect(w.find('[data-testid="all-on"]').exists()).toBe(false);
    expect(w.find('[data-testid="any-on"]').exists()).toBe(true);
    await workshop.toggle("enhanced-submit");
    await workshop.check();
    await flushPromises();
    expect(w.get('[data-testid="action-result"]').text()).toContain(
      "Action denied",
    );
  });
  it("changes entity values per check without changing the session user", async () => {
    const w = await mountWorkshop();
    expect(w.find('[data-testid="vip-checkout"]').exists()).toBe(true);
    await workshop.order("standard");
    await flushPromises();
    expect(w.find('[data-testid="vip-checkout"]').exists()).toBe(false);
    expect(w.get('[data-testid="order-result"]').text()).toBe("OFF");
    expect(workshop.state.user.identity).toBe("alice");
    expect(await workshop.mainService.isFeatureOn("ExpressCheckout")).toBe(false);
  });
  it("refreshes identity exactly once per actual service and updates variants", async () => {
    const w = await mountWorkshop();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await workshop.preset("nonmatching");
    await flushPromises();
    expect(fetchSpy).toHaveBeenCalledTimes(2); // one evaluated + one variants client
    for (const [input] of fetchSpy.mock.calls) {
      const url = new URL(input);
      expect(
        url.searchParams.get(
          url.pathname.includes("variants") ? "userId" : "u",
        ),
      ).toBe("bob");
      expect(url.searchParams.get("claim.role")).toBe("user");
    }
    expect(w.get('[data-testid="variant-name"]').text()).toBe("comfortable");
    expect(workshop.state.snapshot["filter-targeting"]).toBe(false);
    expect(workshop.state.snapshot["filter-always-on"]).toBe(true);
  });
  it("ANDs a local prerequisite with remote values and denies navigation", async () => {
    const w = await mountWorkshop();
    await workshop.local();
    await flushPromises();
    expect(
      w.get('[data-testid="builder-button"]').attributes("disabled"),
    ).toBeDefined();
    await workshop.toggle("enhanced-submit");
    await workshop.local();
    expect(await workshop.mainService.isFeatureOn("enhanced-submit")).toBe(false);
    await workshop.toggle("beta-access");
    await w.get('[data-testid="beta-route"]').trigger("click");
    await flushPromises();
    expect(w.get('[data-testid="route-result"]').text()).toContain("denied");
  });
  it("shows errors, denies defaults and recovers through real SDK refresh", async () => {
    const w = await mountWorkshop();
    await workshop.failure();
    await flushPromises();
    expect(w.get('[role="alert"]').text()).toContain(
      "simulated transport failure",
    );
    expect(workshop.state.snapshot["new-dashboard"]).toBe(false);
    await workshop.failure();
    await flushPromises();
    expect(w.find('[role="alert"]').exists()).toBe(false);
    expect(w.find('[data-testid="new-ui"]').exists()).toBe(true);
  });
});
it("native service enforces missing/false entity gates and unknown defaults without wrappers", async () => {
  const service = new Toggly().init({
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
