// The SDK notifies zoneless OnPush hosts after asynchronous updates.
// Angular 22 supports this path; crypto externalization keeps WebCrypto intact.
import { bootstrapApplication } from "@angular/platform-browser";
import { App } from "./app/app";
import { appConfig } from "./app/app.config";
import { offline } from "./app/sample/config";
import { installOfflineTransport } from "./app/sample/offline";
if (offline) installOfflineTransport();
bootstrapApplication(App, appConfig).catch((error) => console.error(error));
