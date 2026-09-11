const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createTogglyClient } = require("@ops-ai/toggly-client-core");
const {
  orders,
  orderGate,
  registerOrder,
  fixtureFlags,
  demoKeys,
  filters,
} = require("../src/sample/catalog.cjs");
test("native core mapper evaluates VIP/standard and fails closed without entity", async () => {
  const client = createTogglyClient({
    flagDefaults: { ExpressCheckout: orderGate },
  });
  registerOrder(client);
  assert.equal(
    await client.getFlag("ExpressCheckout", false, orders.vip, "Order"),
    true,
  );
  assert.equal(
    await client.getFlag("ExpressCheckout", false, orders.standard, "Order"),
    false,
  );
  assert.equal(await client.getFlag("ExpressCheckout"), false);
  assert.equal(await client.getFlag("unknown"), false);
  client.stopWebSocket();
});
test("native clients isolate initial identity, cache and manual refresh", async () => {
  const calls = [];
  let enabled = true;
  const transport = async (url) => {
    calls.push(new URL(url));
    return new Response(JSON.stringify({ demo: enabled }), { status: 200 });
  };
  const alice = createTogglyClient({
    appKey: "test-only",
    identity: "alice",
    fetch: transport,
  });
  const bob = createTogglyClient({
    appKey: "test-only",
    identity: "bob",
    fetch: transport,
  });
  assert.equal(await alice.getFlag("demo"), true);
  assert.equal(await alice.getFlag("demo"), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.get("u"), "alice");
  enabled = false;
  assert.equal(await bob.getFlag("demo"), false);
  assert.equal(calls[1].searchParams.get("u"), "bob");
  assert.equal(await alice.getFlag("demo"), true);
  await alice.refreshFlags();
  assert.equal(await alice.getFlag("demo"), false);
  alice.stopWebSocket();
  bob.stopWebSocket();
});
test("native failed transport preserves defaults and last known good data", async () => {
  let fail = true;
  const client = createTogglyClient({
    appKey: "test-only",
    flagDefaults: { demo: false },
    fetch: async () => {
      if (fail) throw Error("offline");
      return new Response(JSON.stringify({ demo: true }), { status: 200 });
    },
  });
  assert.equal(await client.getFlag("demo"), false);
  fail = false;
  await client.refreshFlags();
  assert.equal(await client.getFlag("demo"), true);
  fail = true;
  await client.refreshFlags();
  assert.equal(await client.getFlag("demo"), true);
  client.stopWebSocket();
});
test("recorded matrix preserves exact shared keys and truthful always/time behavior", () => {
  const flags = fixtureFlags(
    "nonmatching",
    Object.fromEntries(demoKeys.map((k) => [k, true])),
  );
  assert.equal(filters.length, 11);
  assert.equal(flags["filter-always-on"], true);
  assert.equal(flags["filter-time-window"], true);
  assert.equal(flags["filter-targeting"], false);
});
