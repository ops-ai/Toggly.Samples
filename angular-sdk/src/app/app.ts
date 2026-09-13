import { Component, ChangeDetectionStrategy, inject } from "@angular/core";
import { RouterOutlet, RouterLink } from "@angular/router";
import { Workshop } from "./sample/workshop";
@Component({
  selector: "app-root",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink],
  template: `<header>
      <a routerLink="/">Toggly / Angular workshop</a>
      <nav>
        <a routerLink="/">Workshop</a><a routerLink="/beta">Beta route</a>
      </nav>
    </header>
    <router-outlet />
    <footer>
      Feature flags select presentation. Your server authorizes real actions.
    </footer>`,
})
export class App {
  // Eager hosts let the legacy native child components render their async
  // Signals and async pipes update this zoneless host. No SDK component
  // metadata is changed.
  readonly workshop = inject(Workshop);
}
