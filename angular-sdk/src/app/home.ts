import { Component, ChangeDetectionStrategy, inject } from "@angular/core";
import { AsyncPipe, JsonPipe } from "@angular/common";
import { RouterLink } from "@angular/router";
import { Workshop } from "./sample/workshop";
import { demoKeys, users } from "./sample/catalog";
import { NativeGates } from "./sections/native-gates";
import { OrderPanel } from "./sections/order-panel";
import { FilterMatrix } from "./sections/filter-matrix";
import { Variants } from "./sections/variants";
@Component({
  selector: "app-home",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    JsonPipe,
    RouterLink,
    NativeGates,
    OrderPanel,
    FilterMatrix,
    Variants,
  ],
  templateUrl: "./home.html",
})
export class Home {
  readonly w = inject(Workshop);
  readonly keys = demoKeys;
  readonly users = users;
}
