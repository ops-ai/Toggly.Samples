const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizePreset, resolveHarnessPreset } = require("../src/sample/harness-preset.cjs");

test("normalizePreset accepts shared harness spellings", () => {
  assert.equal(normalizePreset("matching"), "matching");
  assert.equal(normalizePreset("non-matching"), "nonmatching");
  assert.equal(normalizePreset("nonmatching"), "nonmatching");
  assert.equal(normalizePreset("none"), null);
});

test("resolveHarnessPreset reads identity query override", () => {
  const originalWindow = global.window;
  global.window = { location: { search: "?identity=carol" } };
  global.document = { cookie: "" };
  try {
    assert.equal(resolveHarnessPreset().identity, "carol");
  } finally {
    global.window = originalWindow;
  }
});

test("resolveHarnessPreset reads sample-preset cookie when query is absent", () => {
  const originalDocument = global.document;
  const originalWindow = global.window;
  global.document = { cookie: "sample-preset=non-matching" };
  global.window = { location: { search: "" } };
  try {
    const resolved = resolveHarnessPreset();
    assert.equal(resolved.preset, "nonmatching");
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
  }
});
