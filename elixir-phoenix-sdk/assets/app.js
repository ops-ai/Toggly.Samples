import { Socket } from "./phoenix.mjs";
import { LiveSocket } from "./phoenix_live_view.esm.js";
const csrfToken = document
  .querySelector('meta[name="csrf-token"]')
  .getAttribute("content");
// Socket-local context is owned by the server. The browser receives evaluated
// booleans and sends preset events, never the backend SDK app key.
const liveSocket = new LiveSocket("/live", Socket, {
  params: { _csrf_token: csrfToken },
});
liveSocket.connect();
