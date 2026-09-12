import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { webcrypto, createHash } from "node:crypto";
import { chromium } from "playwright";
const origin = process.env.SAMPLE_URL ?? "http://127.0.0.1:5280";
let browser;
before(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
  });
});
after(async () => {
  await browser?.close();
});
async function ready(page, mode) {
  await page.goto(`${origin}/${mode}/identity`);
  if (mode === "wasm")
    await page
      .locator("header")
      .filter({ hasText: "browser runtime" })
      .waitFor();
  else await page.waitForTimeout(700);
}
async function preset(page, name, identity) {
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByTestId("identity").filter({ hasText: identity }).waitFor();
}
test("all four actual render modes, seven pages and separate circuit contexts", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  for (const mode of ["ssr", "server", "wasm", "auto"])
    for (const section of [
      "home",
      "gates",
      "api",
      "identity",
      "entity",
      "filters",
      "framework",
    ]) {
      const response = await page.goto(`${origin}/${mode}/${section}`);
      assert.equal(response.status(), 200);
      await page.getByRole("heading", { level: 1 }).waitFor();
      assert.match(await page.locator("body").innerText(), /Missing app key/);
    }
  for (const mode of ["ssr", "server", "wasm", "auto"]) {
    await page.goto(`${origin}/${mode}/home`);
    await page.getByTestId("dashboard").waitFor();
    assert.equal(await page.getByTestId("dashboard").count(), 1);
    assert.match(await page.getByTestId("dashboard").innerText(), /enabled/);
  }
  const second = await context.newPage();
  await ready(page, "server");
  await ready(second, "server");
  await preset(page, "Matching", "alice");
  await preset(second, "Non-matching", "bob");
  assert.equal(await page.getByTestId("targeting").innerText(), "Targeting ON");
  assert.equal(
    await second.getByTestId("targeting").innerText(),
    "Targeting OFF",
  );
  for (const mode of ["wasm", "auto"]) {
    await ready(page, mode);
    await preset(page, "Matching", "alice");
    await preset(page, "Non-matching", "bob");
  }
  await page.goto(`${origin}/ssr/identity?preset=matching`);
  assert.equal(await page.getByTestId("targeting").innerText(), "Targeting ON");
  await page.goto(`${origin}/server/entity`);
  assert.match(await page.getByTestId("vip").innerText(), /ON$/);
  assert.match(await page.getByTestId("standard").innerText(), /OFF$/);
  assert.deepEqual(failures, []);
  await context.close();
});

test("real WebAssembly verifies canonical signed fixtures, refreshes on push and retains last-known state on failure", async () => {
  // Generate test-only signing material. Every definition request and WebSocket is
  // intercepted below; the fixture App Key is never sent to a remote service.
  const pair = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
  const kid =
    createHash("sha1")
      .update(
        Buffer.concat([
          Buffer.from(jwk.x, "base64url"),
          Buffer.from(jwk.y, "base64url"),
        ]),
      )
      .digest("hex")
      .toUpperCase() + "ES256";
  const jwks = { keys: [{ ...jwk, kid, alg: "ES256" }] };
  let enabled = true,
    invalid = false,
    fail = false,
    revision = 1;
  const sockets = [];
  const context = await browser.newContext();
  const page = await context.newPage();
  const failures = [];
  const requested = [];
  page.on("request", (request) => requested.push(request.url()));
  page.on("pageerror", (error) => failures.push(error.message));
  await page.route("**/public-toggly.json", (route) =>
    route.fulfill({
      json: {
        frontendAppKey: "intercepted-test-fixture",
        environment: "Production",
        backendConfigured: false,
      },
    }),
  );
  await page.route("https://definitions.toggly.io/**", async (route) => {
    if (fail) return route.abort("failed");
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/.well-known/jwks"))
      return route.fulfill({ json: jwks });
    const defs = JSON.stringify({
      "new-dashboard": enabled,
      "api-v2": true,
      "beta-access": true,
      "filter-targeting": url.searchParams.get("u") === "alice",
      ExpressCheckout: {
        requirement: "all",
        rules: [{ property: "Vip", op: "eq", value: "true" }],
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = await webcrypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(defs + "|" + timestamp),
    );
    const signature = Buffer.from(
      await webcrypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        pair.privateKey,
        digest,
      ),
    ).toString("base64");
    await route.fulfill({
      contentType: "application/json",
      headers: { "X-Definitions-Revision": String(revision) },
      body: `{"defs":${defs},"timestamp":${timestamp},"kid":"${kid}","signature":"${invalid ? "AA==" : signature}"}`,
    });
  });
  await page.routeWebSocket("wss://definitions.toggly.io/**", (socket) =>
    sockets.push(socket),
  );
  await ready(page, "wasm");
  await preset(page, "Matching", "alice");
  await page.getByTestId("targeting").filter({ hasText: "ON" }).waitFor();
  await page.getByRole("link", { name: "Entity context", exact: true }).click();
  await page.getByTestId("vip").filter({ hasText: "ON" }).waitFor();
  assert.match(await page.getByTestId("standard").innerText(), /OFF$/);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByTestId("dashboard").filter({ hasText: "enabled" }).waitFor();
  assert.equal(await page.getByTestId("dashboard").count(), 1);
  assert.ok(
    requested.some((url) => url.includes("Toggly.FeatureManagement.Client")),
  );
  assert.doesNotMatch(
    requested.join("\n"),
    /Toggly\.FeatureManagement\.Blazor\.Server|Toggly\.FeatureManagement\.wasm/,
  );
  enabled = false;
  revision++;
  for (const socket of sockets)
    socket.send(
      JSON.stringify({ type: "flags-updated", etag: String(revision) }),
    );
  await page.getByTestId("dashboard").filter({ hasText: "Classic" }).waitFor();
  assert.equal(await page.getByTestId("dashboard").count(), 1);
  await page
    .getByRole("link", { name: "Framework lifecycle", exact: true })
    .click();
  invalid = true;
  enabled = true;
  revision++;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByTestId("error")
    .filter({ hasText: "Invalid signature" })
    .waitFor();
  fail = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  assert.match(await page.getByTestId("dashboard").innerText(), /Classic/);
  assert.ok(
    await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.startsWith("toggly:")),
    ),
  );
  assert.deepEqual(failures, []);
  await context.close();
});

test("fresh browser process restores verified definitions offline and rejects corrupt or cross-context snapshots", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const profile = await mkdtemp(join(tmpdir(), "toggly-blazor-offline-"));
  const pair = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
  // Canonical public-key identifier only; ECDSA/SHA-256 authenticates the envelope.
  const kid =
    createHash("sha1")
      .update(
        Buffer.concat([
          Buffer.from(jwk.x, "base64url"),
          Buffer.from(jwk.y, "base64url"),
        ]),
      )
      .digest("hex")
      .toUpperCase() + "ES256";
  const jwks = { keys: [{ ...jwk, kid, alg: "ES256" }] };
  let context;
  let offlineRequests = 0;
  const launch = async (offline) => {
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
        : {}),
    });
    await context.route("**/public-toggly.json", (route) =>
      route.fulfill({
        json: {
          frontendAppKey: "intercepted-offline-fixture",
          environment: "Production",
          backendConfigured: false,
        },
      }),
    );
    await context.route("https://definitions.toggly.io/**", async (route) => {
      if (offline) {
        offlineRequests++;
        return route.abort("failed");
      }
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/.well-known/jwks"))
        return route.fulfill({ json: jwks });
      const defs = JSON.stringify({
        "new-dashboard": false,
        "filter-targeting": url.searchParams.get("u") === "alice",
      });
      const timestamp = Math.floor(Date.now() / 1000);
      const digest = await webcrypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(defs + "|" + timestamp),
      );
      const signature = Buffer.from(
        await webcrypto.subtle.sign(
          { name: "ECDSA", hash: "SHA-256" },
          pair.privateKey,
          digest,
        ),
      ).toString("base64");
      return route.fulfill({
        json: { defs: JSON.parse(defs), timestamp, kid, signature },
      });
    });
    await context.routeWebSocket("wss://definitions.toggly.io/**", (socket) =>
      socket.close(),
    );
    return context.pages()[0] ?? (await context.newPage());
  };
  try {
    let page = await launch(false);
    await ready(page, "wasm");
    await preset(page, "Matching", "alice");
    await page.getByTestId("targeting").filter({ hasText: "ON" }).waitFor();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page
      .getByTestId("dashboard")
      .filter({ hasText: "Classic" })
      .waitFor();
    await page.waitForFunction(
      () =>
        Object.keys(localStorage).filter((key) => key.startsWith("toggly:"))
          .length >= 2,
    );
    await context.close();

    // Closing the persistent context terminates its Chromium process. The next
    // process starts a fresh WASM runtime and has only durable profile storage.
    page = await launch(true);
    await ready(page, "wasm");
    await preset(page, "Matching", "alice");
    await page.getByTestId("targeting").filter({ hasText: "ON" }).waitFor();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page
      .getByTestId("dashboard")
      .filter({ hasText: "Classic" })
      .waitFor();
    assert.ok(
      offlineRequests > 0,
      "All attempted definitions and JWKS requests are hard-disabled.",
    );
    await page.getByRole("link", { name: "Identity", exact: true }).click();
    await preset(page, "Non-matching", "bob");
    await page.getByTestId("targeting").filter({ hasText: "OFF" }).waitFor();
    await preset(page, "Matching", "alice");
    await page.getByTestId("targeting").filter({ hasText: "ON" }).waitFor();

    // An envelope modified after persistence must not be accepted by a new runtime.
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage).filter((key) =>
        key.startsWith("toggly:"),
      )) {
        const snapshot = JSON.parse(localStorage.getItem(key));
        snapshot.envelope = snapshot.envelope.replace(
          '"defs":{',
          '"defs":{"unknown-fail-closed":true,',
        );
        localStorage.setItem(key, JSON.stringify(snapshot));
      }
    });
    await page.reload();
    await page
      .locator("header")
      .filter({ hasText: "browser runtime" })
      .waitFor();
    await preset(page, "Matching", "alice");
    await page.getByTestId("targeting").filter({ hasText: "OFF" }).waitFor();
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage).filter((key) =>
        key.startsWith("toggly:"),
      ))
        localStorage.setItem(key, "{");
    });
    await page.reload();
    await page
      .locator("header")
      .filter({ hasText: "browser runtime" })
      .waitFor();
    await preset(page, "Matching", "alice");
    await page.getByTestId("targeting").filter({ hasText: "OFF" }).waitFor();
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
