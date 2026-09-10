import "zone.js";
import { TestBed } from "@angular/core/testing";
import { provideZoneChangeDetection, ChangeDetectorRef } from "@angular/core";
import { provideRouter } from "@angular/router";
import {
  provideToggly,
  TogglyService,
  FeatureComponent,
} from "@ops-ai/ngx-feature-flags-toggly";
import { firstValueFrom, filter } from "rxjs";
import { Home } from "./home";
import { routes } from "./app.routes";
import { Workshop } from "./sample/workshop";
import { togglyOptions } from "./sample/config";
import { fixtureState, installOfflineTransport } from "./sample/offline";
import { demoKeys } from "./sample/catalog";
import { Router } from "@angular/router";
import { By } from "@angular/platform-browser";
import { OrderPanel } from "./sections/order-panel";
let restore: () => void;
beforeEach(() => {
  fixtureState.fail = false;
  fixtureState.toggles = Object.fromEntries(demoKeys.map((k) => [k, true]));
  restore = installOfflineTransport();
  TestBed.configureTestingModule({
    imports: [Home],
    providers: [
      provideZoneChangeDetection(),
      provideRouter(routes),
      provideToggly(togglyOptions()),
    ],
  });
});
afterEach(() => {
  TestBed.resetTestingModule();
  restore();
  vi.restoreAllMocks();
});
// Unit JIT links this older SDK component as OnPush. Explicitly mark that
// child view in the harness; production browser tests prove actual AOT updates
// without test code marking SDK views or changing its metadata.
function detect(fixture: ReturnType<typeof TestBed.createComponent<Home>>) {
  fixture.debugElement
    .queryAll(By.directive(FeatureComponent))
    .forEach((view) => view.injector.get(ChangeDetectorRef).markForCheck());
  fixture.debugElement
    .query(By.directive(OrderPanel))
    ?.injector.get(ChangeDetectorRef)
    .markForCheck();
  fixture.changeDetectorRef.markForCheck();
  fixture.detectChanges();
}
async function mount() {
  const fixture = TestBed.createComponent(Home);
  fixture.autoDetectChanges();
  await firstValueFrom(
    TestBed.inject(Workshop).snapshot$.pipe(filter(Boolean)),
  );
  await fixture.whenStable();
  await vi.waitFor(() => {
    detect(fixture);
    expect(
      fixture.nativeElement.querySelector('[data-testid="native-component"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="variant-compact"]'),
    ).not.toBeNull();
  });
  return fixture;
}
it("renders real native component/template/directive/builder and variant directive", async () => {
  const fixture = await mount();
  const el: HTMLElement = fixture.nativeElement;
  expect(el.querySelector('[data-testid="native-component"]')).not.toBeNull();
  expect(el.querySelector('[data-testid="native-directive"]')).not.toBeNull();
  expect(
    el.querySelector('[data-testid="builder"]')?.hasAttribute("disabled"),
  ).toBe(false);
  expect(el.querySelector('[data-testid="variant-compact"]')).not.toBeNull();
  expect(el.querySelectorAll("tbody tr")).toHaveLength(11);
});
it("native negation, all/any, local gates and Order values stay coherent", async () => {
  const fixture = await mount(),
    w = TestBed.inject(Workshop),
    sdk = TestBed.inject(TogglyService);
  await w.toggle("new-dashboard");
  fixture.nativeElement
    .querySelectorAll("button")
    .forEach((button: HTMLButtonElement) => {
      if (button.textContent === "Standard Order") button.click();
    });
  await fixture.whenStable();
  detect(fixture);
  expect(await sdk.isFeatureOn("ExpressCheckout", w.order, "Order")).toBe(
    false,
  );
  await vi.waitFor(() => {
    detect(fixture);
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="order-builder"]')
        ?.hasAttribute("disabled"),
    ).toBe(true);
  });
  w.local();
  await fixture.whenStable();
  detect(fixture);
  const el: HTMLElement = fixture.nativeElement;
  expect(el.querySelector('[data-testid="native-component"]')).toBeNull();
  expect(el.querySelector('[data-testid="old-ui"]')).not.toBeNull();
  expect(el.querySelector('[data-testid="all"]')).toBeNull();
  expect(el.querySelector('[data-testid="any"]')).not.toBeNull();
  expect(el.querySelector('[data-testid="order-component"]')).toBeNull();
  expect(
    el.querySelector('[data-testid="order-builder"]')?.hasAttribute("disabled"),
  ).toBe(true);
  expect(await sdk.isFeatureOn("ExpressCheckout")).toBe(false);
  expect(await sdk.isFeatureOn("enhanced-submit")).toBe(false);
  await w.toggle("enhanced-submit");
  w.local();
  expect(await sdk.isFeatureOn("enhanced-submit")).toBe(false);
});
it("refreshes each native client once with full identity and changes native variants", async () => {
  const fixture = await mount(),
    w = TestBed.inject(Workshop);
  const requests = vi.spyOn(globalThis, "fetch");
  await w.selectPreset("nonmatching");
  await fixture.whenStable();
  await vi.waitFor(() => {
    detect(fixture);
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="variant-comfortable"]',
      ),
    ).not.toBeNull();
  });
  expect(requests).toHaveBeenCalledTimes(2);
  for (const [input] of requests.mock.calls) {
    const url = new URL(String(input));
    expect(
      url.searchParams.get(url.pathname.includes("variants") ? "userId" : "u"),
    ).toBe("bob");
    expect(url.searchParams.get("claim.role")).toBe("user");
  }
  expect(
    fixture.nativeElement.querySelector('[data-testid="variant-comfortable"]'),
  ).not.toBeNull();
});
it("native external refresh updates component and copied snapshot, then cleanup removes bridge listener", async () => {
  const fixture = await mount(),
    sdk = TestBed.inject(TogglyService),
    w = TestBed.inject(Workshop);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({ "new-dashboard": false, "filter-always-on": false }),
      { status: 200 },
    ),
  );
  // Public service refresh emits the same notification consumed after WebSocket
  // loads. No workshop control is invoked to hide a missing subscription.
  await sdk.setContext({
    identity: "alice",
    groups: ["beta"],
    claims: { role: "admin" },
  });
  await fixture.whenStable();
  await vi.waitFor(() => {
    detect(fixture);
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="toggle-new-dashboard"]',
      ).textContent,
    ).toContain("OFF");
  });
  expect(
    fixture.nativeElement.querySelector('[data-testid="native-component"]'),
  ).toBeNull();
  expect(
    fixture.nativeElement.querySelector('[data-testid="toggle-new-dashboard"]')
      .textContent,
  ).toContain("OFF");
  expect(
    fixture.nativeElement.querySelector('[data-testid="filter-always-on"]')
      .textContent,
  ).toContain("OFF");
  w.ngOnDestroy();
  fixture.destroy();
  const checks = vi.spyOn(sdk, "isFeatureOn");
  await sdk.setContext({ identity: "alice" });
  expect(checks).not.toHaveBeenCalled();
});
it("native error/default path recovers and functional guard denies a disabled route", async () => {
  const fixture = await mount(),
    w = TestBed.inject(Workshop),
    router = TestBed.inject(Router);
  await w.failure();
  await fixture.whenStable();
  detect(fixture);
  expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  await w.failure();
  await w.toggle("beta-access");
  await router.navigateByUrl("/beta");
  expect(router.url).toBe("/");
  await w.toggle("beta-access");
  await router.navigateByUrl("/beta");
  expect(router.url).toBe("/beta");
});
