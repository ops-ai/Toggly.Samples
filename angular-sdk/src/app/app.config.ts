import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  provideBrowserGlobalErrorListeners,
} from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideToggly } from "@ops-ai/ngx-feature-flags-toggly";
import { togglyOptions } from "./sample/config";
import { routes } from "./app.routes";
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideToggly(togglyOptions()),
  ],
};
