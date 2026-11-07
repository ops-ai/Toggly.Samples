const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const stock = require("@ops-ai/toggly-hooks-types/dist/entity-gate.js");

const root = path.resolve(__dirname, "..");
const stockPath = path.join(
  root,
  "node_modules/@ops-ai/toggly-hooks-types/dist/entity-gate.js",
);
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "toggly-entity-gate-stock") {
    return stockPath;
  }
  if (request === "toggly-hooks-types-stock") {
    return path.join(root, "node_modules/@ops-ai/toggly-hooks-types/dist/index.js");
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
const patched = require("../src/sample/toggly-hooks-types-browser-shim.cjs");
Module._resolveFilename = originalResolve;

test("stock hooks-types treats evaluated { enabled } envelopes as OFF", () => {
  assert.equal(stock.resolveEvaluatedDefinition({ enabled: true }), false);
  assert.equal(
    stock.toBooleanDefinitions({ "filter-always-on": { enabled: true } })[
      "filter-always-on"
    ],
    false,
  );
});

test("patched resolver matches evaluated-signed AlwaysOn envelopes", () => {
  assert.equal(patched.resolveEvaluatedDefinition({ enabled: true }), true);
  assert.equal(patched.resolveEvaluatedDefinition({ enabled: false }), false);
  assert.deepEqual(
    patched.toBooleanDefinitions({
      "filter-always-on": { enabled: true },
      "filter-targeting": true,
    }),
    { "filter-always-on": true, "filter-targeting": true },
  );
});
