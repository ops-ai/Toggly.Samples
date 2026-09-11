import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
@Component({
  selector: "app-beta",
  imports: [RouterLink],
  template: `<main class="workshop">
    <section class="panel">
      <h1 data-testid="beta-page">Native guard admitted this route</h1>
      <p>
        featureFlagGuard checked beta-access before navigation. This is a UI
        boundary, not server authorization. A flag changing after entry does not
        automatically evict an existing route.
      </p>
      <a routerLink="/">Return to workshop</a>
    </section>
  </main>`,
})
export class Beta {}
