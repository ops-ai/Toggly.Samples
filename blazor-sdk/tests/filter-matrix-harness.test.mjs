import assert from "node:assert/strict";
import { test } from "node:test";
import { boot } from "./live-policy.mjs";

test("LiveE2E harness URL preset=matching enables filter-country via demo matrix API", async () => {
  const { origin, release } = await boot();
  try {
    const response = await fetch(
      `${origin}/api/demo-filter-matrix?preset=matching`,
      { headers: { "x-demo-preset": "matching" } },
    );
    assert.equal(response.status, 200);
    const matrix = await response.json();
    assert.equal(matrix["filter-country"], true);
    assert.equal(matrix["filter-targeting"], true);
  } finally {
    await release();
  }
});
