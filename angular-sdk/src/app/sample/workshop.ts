import { Injectable, OnDestroy, inject, signal } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { TogglyService } from "@ops-ai/ngx-feature-flags-toggly";
import { allKeys, Order, orders, OrderName, Preset, users } from "./catalog";
import { fixtureState } from "./offline";
import { offline } from "./config";
@Injectable({ providedIn: "root" })
export class Workshop implements OnDestroy {
  readonly sdk = inject(TogglyService);
  readonly offline = offline;
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
      this.sdk.subscribeFeaturesRefresh(() => void this.snapshot()),
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
  async selectPreset(preset: Preset) {
    if (this.busy) return;
    this.preset = preset;
    await this.refreshContext();
  }
  async refreshContext() {
    ++this.revision;
    this.busy = true;
    try {
      // setContext refreshes itself. Never add a second refresh request.
      this.contextChanges.next(users[this.preset]);
      await this.sdk.setContext(users[this.preset]);
      await this.snapshot();
    } catch {
      // A later failed refresh restores the last good SDK snapshot and records
      // lastError. Keep this workshop recovery control interactive and publish
      // that state through the same snapshot used by the OnPush views.
      await this.snapshot();
    } finally {
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
  async failure() {
    if (!offline) return;
    fixtureState.fail = !fixtureState.fail;
    await this.refreshContext();
  }
  ngOnDestroy() {
    this.disposed = true;
    ++this.revision;
    this.stops.forEach((stop) => stop());
    this.snapshotSubject.complete();
    this.contextChanges.complete();
  }
}
