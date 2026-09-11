// This SDK's asynchronous native components use zone-driven change detection.
// Angular22 supports opting in; crypto externalization keeps WebCrypto intact.
import "zone.js";
import { bootstrapApplication } from "@angular/platform-browser";
import { App } from "./app/app";
import { appConfig } from "./app/app.config";
import { offline } from "./app/sample/config";
import { installOfflineTransport } from "./app/sample/offline";
if (offline) installOfflineTransport();
bootstrapApplication(App, appConfig).catch((error) => console.error(error));
