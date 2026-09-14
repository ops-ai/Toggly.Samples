import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { configuration, isPushApplied } from "./live-policy.mjs";

test("live configuration refuses implicit opt-in, missing keys and remote hosts", () => {
  assert.throws(() => configuration({}), /configuration-required/);
  const env = {
    TOGGLY_LIVE_ACCEPTANCE: "1",
    TOGGLY_FRONTEND_APP_KEY: "test-input-only",
    TOGGLY_ENVIRONMENT: "Production",
  };
  assert.throws(
    () => configuration({ ...env, SAMPLE_URL: "https://example.com" }),
    /configuration-required/,
  );
  assert.equal(configuration(env).origin, "http://localhost:5280");
});

test("HTTP polling, stale envelopes and pre-marker socket frames cannot count as push", () => {
  const previous = { hash: "a", revision: "r1" };
  const next = {
    hash: "b",
    revision: "r2",
    value: false,
    requestSequence: 12,
    responseSequence: 13,
  };
  assert.equal(isPushApplied(10, 11, previous, next, false), true);
  assert.equal(isPushApplied(10, 9, previous, next, false), false);
  assert.equal(isPushApplied(10, 14, previous, next, false), false);
  assert.equal(
    isPushApplied(10, 11, previous, { ...next, hash: "a" }, false),
    false,
  );
  assert.equal(
    isPushApplied(10, 11, previous, { ...next, revision: "r1" }, false),
    false,
  );
  assert.equal(isPushApplied(10, 11, previous, next, true), false);
});

for (const optIn of [false, true]) {
  test(`actual browser runner refuses missing configuration (opt-in ${optIn})`, () => {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith("TOGGLY_")),
    );
    if (optIn) env.TOGGLY_LIVE_ACCEPTANCE = "1";
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("./live.browser.mjs", import.meta.url))],
      { env, encoding: "utf8", timeout: 5000 },
    );
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stdout).event, "configuration-required");
    assert.equal(result.stderr, "");
  });
}
