import { Component, ChangeDetectionStrategy, inject } from "@angular/core";
import { JsonPipe } from "@angular/common";
import { NgxFeatureFlagsTogglyModule } from "@ops-ai/ngx-feature-flags-toggly";
import { Workshop } from "../sample/workshop";
@Component({
  selector: "app-order-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxFeatureFlagsTogglyModule, JsonPipe],
  template: ` <section class="panel" id="order">
    <h2>05 · Same user. Different Order.</h2>
    <p>
      The real service mapper creates kind/key/attributes for this evaluation.
      It does not change session identity or upload a dashboard schema.
    </p>
    <button (click)="w.selectOrder('vip')">VIP Order</button>
    <button (click)="w.selectOrder('standard')">Standard Order</button>
    <pre>{{ w.order | json }}</pre>
    <feature
      featureKey="ExpressCheckout"
      [context]="w.order"
      contextKind="Order"
      ><ng-template featureTemplate
        ><p data-testid="order-component">
          Native component: Express Checkout
        </p></ng-template
      ></feature
    >
    <p
      *featureFlag="'ExpressCheckout'; context: w.order; kind: 'Order'"
      data-testid="order-directive"
    >
      Native directive: Express Checkout
    </p>
    <button
      *featureGateBuilder="
        'ExpressCheckout';
        context: w.order;
        kind: 'Order';
        let enabled
      "
      [disabled]="!enabled"
      data-testid="order-builder"
    >
      Order builder: {{ enabled ? "ON" : "OFF" }}
    </button>
    <p>
      No Order context means an EntityGate is denied. Selecting another Order
      never changes the signed-in user's identity.
    </p>
  </section>`,
})
export class OrderPanel {
  readonly w = inject(Workshop);
}
