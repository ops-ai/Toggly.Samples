const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const root = path.resolve(__dirname, "..");

/** Published 1.4.6 resolver, isolated from the file prestart/prebuild patches. */
const STOCK_RESOLVER = `function resolveEvaluatedDefinition(value, context, defaultValue = false) {
    if (value == null) return defaultValue;
    if (value === true) return true;
    if (value === false) return false;
    if (!isEntityGate(value)) return false;
    return false;
}
function isEntityGate(value) {
    return Boolean(value && typeof value === "object" && Array.isArray(value.rules));
}
return resolveEvaluatedDefinition;`;
const stockResolveEvaluatedDefinition = new Function(STOCK_RESOLVER)();
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

test("stock hooks-types 1.4.6 treats evaluated { enabled } envelopes as OFF", () => {
  assert.equal(stockResolveEvaluatedDefinition({ enabled: true }), false);
  assert.equal(stockResolveEvaluatedDefinition({ enabled: false }), false);
  assert.equal(stockResolveEvaluatedDefinition(true), true);
});

test("installed resolver follows the package patch when prestart has run", () => {
  const installed = fs.readFileSync(stockPath, "utf8");
  const resolve = require(stockPath).resolveEvaluatedDefinition;
  const patched = installed.includes(
    'typeof value.enabled === "boolean" && !isEntityGate(value)',
  );
  assert.equal(resolve({ enabled: true }), patched);
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
