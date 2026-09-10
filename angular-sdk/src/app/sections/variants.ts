import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnDestroy,
  signal,
} from "@angular/core";
import { JsonPipe } from "@angular/common";
import { skip } from "rxjs";
import {
  NgxFeatureFlagsTogglyModule,
  TogglyService,
  TogglyOptions,
  VariantResult,
} from "@ops-ai/ngx-feature-flags-toggly";
import { Workshop } from "../sample/workshop";
import { togglyOptions } from "../sample/config";
@Component({
  selector: "app-variants",
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgxFeatureFlagsTogglyModule, JsonPipe],
  providers: [
    {
      provide: TogglyOptions,
      useFactory: () => ({
        ...togglyOptions(true),
        ...inject(Workshop).contextChanges.value,
      }),
    },
    TogglyService,
  ],
  template: ` <section class="panel" id="variants">
    <h2>07 · Choose an experience, not just ON/OFF</h2>
    <p>
      Native featureVariant and getVariant read evaluated-variants assignments.
      This panel has its own injected TogglyService, because a flattened variant
      response cannot carry the main client's Order rule.
    </p>
    <p
      *featureVariant="'new-dashboard'; variant: 'compact'"
      data-testid="variant-compact"
    >
      Native variant directive: compact
    </p>
    <p
      *featureVariant="'new-dashboard'; variant: 'comfortable'"
      data-testid="variant-comfortable"
    >
      Native variant directive: comfortable
    </p>
    <p data-testid="variant-name">
      Assigned variant: {{ variant()?.name || "None" }}
    </p>
    <pre>{{ variant()?.configurationValue | json }}</pre>
    <p>
      Keep the existing layout if no variant is assigned. Offline assignments
      are recorded fixtures, not a running experiment. Live assignments follow
      your configured rules.
    </p>
  </section>`,
})
export class Variants implements OnDestroy {
  private readonly sdk = inject(TogglyService);
  private readonly w = inject(Workshop);
  variant = signal<VariantResult | null>(null);
  private active = true;
  private revision = 0;
  private readonly stop = this.sdk.subscribeFeaturesRefresh(
    () => void this.read(),
  );
  private readonly contexts = this.w.contextChanges
    .pipe(skip(1))
    .subscribe((context) => {
      ++this.revision;
      this.variant.set(null);
      void this.sdk.setContext(context);
    });
  constructor() {
    void this.read();
  }
  private async read() {
    const revision = ++this.revision;
    const variant = await this.sdk.getVariant("new-dashboard");
    if (this.active && revision === this.revision) this.variant.set(variant);
  }
  ngOnDestroy() {
    this.active = false;
    ++this.revision;
    this.stop();
    this.contexts.unsubscribe();
  }
}
