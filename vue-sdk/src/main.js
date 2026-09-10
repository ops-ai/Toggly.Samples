import { createApp } from "vue";
import { toggly, togglyService } from "@ops-ai/vue-feature-flags-toggly";
import App from "./App.vue";
import { createWorkshop, workshopKey } from "./sample/workshop";
import "./style.css";

// Vite only exposes explicitly prefixed VITE_ values to browser source. Every
// value used here is public in the built app. Never paste a management API key.
const workshop = createWorkshop();
const app = createApp(App);
app.use(toggly, workshop.options); // Registers native Feature and injects $toggly.
app.provide(workshopKey, workshop);
app.mount("#app");
workshop.attach(togglyService);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    app.unmount();
    workshop.dispose();
  });
