import { Component, inject } from "@angular/core";
import { AsyncPipe, JsonPipe } from "@angular/common";
import { Workshop } from "../sample/workshop";
import { filters, httpPresets } from "../sample/catalog";
@Component({
  selector: "app-filter-matrix",
  imports: [AsyncPipe, JsonPipe],
  template: `<section class="panel" id="filters">
    <h2>06 · Eleven filters, one context</h2>
    <p>
      {{
        w.offline
          ? "Recorded outcomes consumed by the real SDK."
          : "Live evaluated results from your real browser request."
      }}
      HTTP presets are reference inputs, not browser overrides. Percentage is
      illustrative offline, not a copied production hash.
    </p>
    <details>
      <summary>Reference HTTP inputs</summary>
      <pre>{{ http[w.preset] | json }}</pre>
    </details>
    @if (w.snapshot$ | async; as flags) {
      <table>
        <thead>
          <tr>
            <th>Flag / filter</th>
            <th>Rule</th>
            <th>Actual SDK result</th>
          </tr>
        </thead>
        <tbody>
          @for (f of filters; track f.key) {
            <tr [attr.data-testid]="f.key">
              <td>
                <code>{{ f.key }}</code
                ><br />{{ f.name }}
              </td>
              <td>{{ f.rule }}</td>
              <td>{{ flags[f.key] ? "ON" : "OFF" }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
    <p>
      Macintosh is the device value; Mac is the OS. AlwaysOn and the open
      TimeWindow stay on. Neither preset promises a particular live 50% outcome.
      ContextProperty is evaluated locally with the selected Order.
    </p>
  </section>`,
})
export class FilterMatrix {
  readonly w = inject(Workshop);
  readonly filters = filters;
  readonly http = httpPresets;
}
