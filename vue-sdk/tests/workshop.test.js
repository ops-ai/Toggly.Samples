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
async function mountWorkshop() {
  workshop = createWorkshop({});
  wrapper = mount(App, {
    global: {
      plugins: [[toggly, workshop.options]],
      provide: { [workshopKey]: workshop },
    },
  });
  await workshop.attach(togglyService);
  await flushPromises();
  return wrapper;
}
describe("real published Vue plugin and native surfaces", () => {
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
    expect(await togglyService.isFeatureOn("ExpressCheckout")).toBe(false);
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
    expect(await togglyService.isFeatureOn("enhanced-submit")).toBe(false);
    await workshop.toggle("beta-access");
    await w.get('[data-testid="beta-route"]').trigger("click");
    await flushPromises();
    expect(w.get('[data-testid="route-result"]').text()).toContain("denied");
  });
  it("shows errors, denies defaults and recovers through real SDK refresh", async () => {
    const w = await mountWorkshop();
    await workshop.failure();
    await flushPromises();
    expect(w.get('[role="alert"]').text()).toContain("fetching feature flags");
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
