const { test } = require("node:test");
const assert = require("node:assert/strict");
const stock = require("@ops-ai/toggly-hooks-types/dist/entity-gate.js");
const patched = require("../src/sample/entity-gate-patch.cjs");

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
