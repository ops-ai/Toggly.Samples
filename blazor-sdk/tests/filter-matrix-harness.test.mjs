import assert from "node:assert/strict";
import { test } from "node:test";

const origin = process.env.SAMPLE_URL ?? "http://127.0.0.1:5280";

test("LiveE2E harness URL preset=matching enables filter-country via demo matrix API", async () => {
  const response = await fetch(
    `${origin}/api/demo-filter-matrix?preset=matching`,
    { headers: { "x-demo-preset": "matching" } },
  );
  assert.equal(response.status, 200);
  const matrix = await response.json();
  assert.equal(matrix["filter-country"], true);
  assert.equal(matrix["filter-targeting"], true);
});
