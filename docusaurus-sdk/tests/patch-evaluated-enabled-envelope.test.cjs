const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  patchEntityGateSource,
} = require("../src/sample/patch-evaluated-enabled-envelope.cjs");

const STOCK = `function resolveEvaluatedDefinition(value, context, defaultValue = false) {
    if (value == null) {
        return defaultValue;
    }
    if (value === true) {
        return true;
    }
    if (value === false) {
        return false;
    }
    if (!isEntityGate(value)) {
        return false;
    }
    return false;
}
`;

test("patches the stock false branch to honor enabled envelopes", () => {
  const once = patchEntityGateSource(STOCK);
  assert.equal(once.changed, true);
  assert.match(once.source, /return value\.enabled;/);
  const twice = patchEntityGateSource(once.source);
  assert.equal(twice.changed, false);
  assert.equal(twice.source, once.source);

  const resolve = new Function(
    `${once.source}
function isEntityGate(value) {
  return value && typeof value === "object" && Array.isArray(value.rules);
}
return resolveEvaluatedDefinition;`,
  )();
  assert.equal(resolve({ enabled: true }), true);
  assert.equal(resolve({ enabled: false }), false);
  assert.equal(resolve(true), true);
  assert.equal(resolve({ rules: [] }), false);
});
