import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { from, Observable } from "rxjs";
import {
  NgxFeatureFlagsTogglyModule,
  TogglyService,
} from "@ops-ai/ngx-feature-flags-toggly";
@Component({
  selector: "app-native-gates",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxFeatureFlagsTogglyModule, AsyncPipe],
  templateUrl: "./native-gates.html",
})
export class NativeGates {
  readonly sdk = inject(TogglyService);
  result = signal("No action yet");
  observable = signal<Observable<boolean> | null>(null);
  async check() {
    this.result.set(
      (await this.sdk.isFeatureOn("enhanced-submit"))
        ? "Action allowed (demo only)"
        : "Action denied",
    );
  }
  observe() {
    this.observable.set(from(this.sdk.isFeatureOn("enhanced-submit")));
  }
}
