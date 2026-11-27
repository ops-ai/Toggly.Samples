const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  LIVE_CACHE,
  STALE_CACHE,
  patchLiveFlagRefreshSource,
} = require("../src/sample/patch-live-flag-refresh.cjs");

test("configured refresh interval is not stretched while a WebSocket is connected", () => {
  const once = patchLiveFlagRefreshSource(
    `const interval = ${STALE_CACHE.slice("const interval = ".length)}`,
  );
  assert.equal(once.changed, true);
  assert.equal(once.source.includes(STALE_CACHE), false);
  assert.equal(once.source.includes(LIVE_CACHE), true);
  const twice = patchLiveFlagRefreshSource(once.source);
  assert.equal(twice.changed, false);
});
