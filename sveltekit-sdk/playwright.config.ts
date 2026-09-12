import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',use:{baseURL:'http://127.0.0.1:4183'},webServer:{command:'npm run build && ORIGIN=http://127.0.0.1:4183 HOST=127.0.0.1 PORT=4183 npm start',url:'http://127.0.0.1:4183',reuseExistingServer:false,timeout:120000}});
