import { Routes } from "@angular/router";
import { featureFlagGuard } from "@ops-ai/ngx-feature-flags-toggly";
import { Home } from "./home";
import { Beta } from "./sections/beta";
export const routes: Routes = [
  { path: "", component: Home },
  {
    path: "beta",
    component: Beta,
    canActivate: [featureFlagGuard],
    data: { featureFlag: "beta-access", featureFlagRedirect: "/" },
  },
  { path: "**", redirectTo: "" },
];
