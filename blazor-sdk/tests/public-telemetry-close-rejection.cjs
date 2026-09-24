// Loaded only by the cleanup regression child process.
const fs = require("node:fs");
const http = require("node:http");
const Module = require("node:module");
const probeFile = process.env.TOGGLY_CLOSE_PROBE_FILE;
const write = (value) => fs.appendFileSync(probeFile, `${JSON.stringify(value)}\n`);

const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) {
  this.once("listening", () => write({ port: this.address().port }));
  return listen.apply(this, args);
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  const module = load.call(this, request, parent, isMain);
  if (request !== "playwright") return module;
  return { ...module, chromium: {
    launchServer: async (...args) => {
      const server = await module.chromium.launchServer(...args);
      write({ pid: server.process().pid });
      return server;
    },
    connect: async (...args) => {
      const browser = await module.chromium.connect(...args);
      browser.newPage = async () => { throw new Error("injected-page-failure"); };
      browser.close = async () => { throw new Error("injected-browser-close-rejection"); };
      return browser;
    },
  }};
};
