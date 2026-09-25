import { mount } from "svelte";
import { createToggly } from "@ops-ai/svelte-feature-flags-toggly";
import App from "./App.svelte";
import { createWorkshop } from "./sample/workshop";
import "./style.css";

// Vite only exposes explicitly prefixed VITE_ values to browser source. Every
// value used here is public in the built app. Never paste a management API key.
const workshop = createWorkshop();
// createToggly owns the process-wide Svelte stores. Await it before mounting
// Feature consumers so the first evaluation already has identity targeting.
await createToggly(workshop.options);
await workshop.attach();
const app = mount(App, {
  target: document.getElementById("app"),
  props: { workshop },
});
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    app.unmount();
    workshop.dispose();
  });
}
