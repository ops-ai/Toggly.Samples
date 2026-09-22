import { computed, Injectable, OnDestroy, inject, signal } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { TogglyService } from "@ops-ai/ngx-feature-flags-toggly";
import { allKeys, Order, orders, OrderName, Preset, users } from "./catalog";
import { fixtureState } from "./offline";
import { offline, telemetryEnabled } from "./config";
type TelemetrySelection = Readonly<{
  generation: number;
  context: string;
  enabled: boolean;
  variant: string;
}>;
@Injectable({ providedIn: "root" })
export class Workshop implements OnDestroy {
  readonly sdk = inject(TogglyService);
  readonly offline = offline;
  readonly telemetryEnabled = telemetryEnabled;
  readonly telemetrySelection = signal<TelemetrySelection | null>(null);
  readonly telemetryResult = computed(() => {
    const selection = this.currentTelemetrySelection();
    return selection
      ? `new-dashboard: ${selection.enabled ? "ON" : "OFF"} · variant ${selection.variant}`
      : "Evaluate new-dashboard to select a current variant before recording usage or a view.";
  });
  readonly telemetryActionStatus = signal("");
  preset: Preset = "matching";
  order: Order = orders.vip;
  busy = false;
  error = signal("");
  localAllowed = true;
  get transportFailed() {
    return fixtureState.fail;
  }
  // SDK exposes refresh callbacks, not a built-in Observable. This small RxJS
  // bridge lets Angular's async pipe consume actual SDK checks, including updates
  // originating from WebSocket delivery rather than a workshop button.
  private readonly snapshotSubject = new BehaviorSubject<Record<
    string,
    boolean
  > | null>(null);
  readonly snapshot$ = this.snapshotSubject.asObservable();
  readonly contextChanges = new BehaviorSubject(users.matching);
  private revision = 0;
  private selectionGeneration = 0;
  private disposed = false;
  private stops: (() => void)[] = [];
  constructor() {
    // Register before templates evaluate. A stable Order key identifies the
    // object; its attributes vary without replacing the signed-in user.
    this.sdk.registerContext<Order>("Order", (o) => ({
      kind: "Order",
      key: o.Id,
      attributes: { Vip: o.Vip, Total: o.Total },
    }));
    // This local prerequisite can only restrict the remotely enabled action.
    this.sdk.setLocalGates([
      {
        id: "device-ready",
        flagKeys: ["enhanced-submit"],
        isEnabled: () => this.localAllowed,
      },
    ]);
    this.stops = [
      this.sdk.subscribeFeaturesRefresh(() => void this.refreshFromSdk()),
      this.sdk.subscribeLocalGatesChanged(() => void this.snapshot()),
    ];
    void this.snapshot();
  }
  private async snapshot() {
    if (this.disposed) return;
    // Checks are asynchronous. Ignore an old batch if the user selects another
    // Order/session or this service is destroyed before those checks finish.
    const revision = ++this.revision;
    const order = this.order,
      preset = this.preset;
    const entries = await Promise.all(
      allKeys.map(
        async (key) =>
          [key, await this.sdk.isFeatureOn(key, order, "Order")] as const,
      ),
    );
    if (
      !this.disposed &&
      revision === this.revision &&
      order === this.order &&
      preset === this.preset
    ) {
      this.snapshotSubject.next(Object.fromEntries(entries));
      this.error.set(this.sdk.lastError || "");
    }
  }
  private async refreshFromSdk() {
    const generation = this.invalidateTelemetrySelection();
    const context = users[this.preset].identity;
    await this.snapshot();
    await this.resolveTelemetrySelection(generation, context);
  }
  private invalidateTelemetrySelection() {
    const generation = ++this.selectionGeneration;
    this.telemetrySelection.set(null);
    return generation;
  }
  private currentTelemetrySelection() {
    const selection = this.telemetrySelection();
    return selection &&
      selection.generation === this.selectionGeneration &&
      selection.context === users[this.preset].identity
      ? selection
      : null;
  }
  private async resolveTelemetrySelection(generation: number, context: string) {
    let enabled = false;
    let variant = "disabled";
    try {
      enabled = await this.sdk.isFeatureOn("new-dashboard");
      const assigned = await this.sdk.getVariant("new-dashboard");
      variant = assigned?.name ?? (enabled ? "enabled" : "disabled");
    } catch {
      // A failed check leaves the sample without an actionable selection.
    }
    if (
      this.disposed ||
      generation !== this.selectionGeneration ||
      context !== users[this.preset].identity
    )
      return;
    this.telemetrySelection.set(
      Object.freeze({ generation, context, enabled, variant }),
    );
  }
  async selectPreset(preset: Preset) {
    if (this.busy) return;
    this.preset = preset;
    await this.refreshContext();
  }
  async refreshContext() {
    ++this.revision;
    const generation = this.invalidateTelemetrySelection();
    const context = users[this.preset].identity;
    this.busy = true;
    try {
      // setContext refreshes itself. Never add a second refresh request.
      this.contextChanges.next(users[this.preset]);
      await this.sdk.setContext(users[this.preset]);
      await this.snapshot();
    } catch {
      // After a context change, a failed refresh keeps the new identity and
      // cached/default flags; it never exposes the previous user's snapshot.
      // Publish that safe state through the same snapshot used by OnPush views.
      await this.snapshot();
    } finally {
      await this.resolveTelemetrySelection(generation, context);
      this.busy = false;
    }
  }
  async selectOrder(name: OrderName) {
    this.order = orders[name];
    await this.snapshot();
  }
  async toggle(key: string) {
    if (!offline || this.busy) return;
    fixtureState.toggles[key] = !fixtureState.toggles[key];
    await this.refreshContext();
  }
  local() {
    this.localAllowed = !this.localAllowed;
    this.sdk.notifyLocalGatesChanged();
  }
  async evaluateTelemetryFlag() {
    const generation = this.invalidateTelemetrySelection();
    await this.resolveTelemetrySelection(
      generation,
      users[this.preset].identity,
    );
    this.telemetryActionStatus.set(
      "The SDK captures this feature check automatically when telemetry is enabled.",
    );
  }
  recordTelemetryUsage() {
    const selection = this.currentTelemetrySelection();
    if (!selection) return;
    this.sdk.recordUsage("new-dashboard", selection.variant);
    this.telemetryActionStatus.set("Usage event added to the SDK telemetry batch.");
  }
  recordTelemetryView() {
    const selection = this.currentTelemetrySelection();
    if (!selection) return;
    this.sdk.recordView("new-dashboard", selection.variant);
    this.telemetryActionStatus.set("View event added to the SDK telemetry batch.");
  }
  incrementSampleActions() {
    this.sdk.incrementCounter("sample-actions", 1);
    this.telemetryActionStatus.set("Counter event added to the SDK telemetry batch.");
  }
  setSampleCartSize() {
    this.sdk.setGauge("sample-cart-size", 3);
    this.telemetryActionStatus.set("Gauge event added to the SDK telemetry batch.");
  }
  async flushTelemetry() {
    try {
      await this.sdk.flushTelemetry();
      this.telemetryActionStatus.set("Flush completed; telemetry delivery is best effort.");
    } catch {
      this.telemetryActionStatus.set("Flush could not be completed.");
    }
  }
  async failure() {
    if (!offline) return;
    fixtureState.fail = !fixtureState.fail;
    await this.refreshContext();
  }
  ngOnDestroy() {
    this.disposed = true;
    ++this.revision;
    this.invalidateTelemetrySelection();
    this.stops.forEach((stop) => stop());
    this.snapshotSubject.complete();
    this.contextChanges.complete();
  }
}
