// Browser tests use the published SDK and real browser WebCrypto. Only network
// transport is faked. No private SDK fields or sample-only substitute gates.
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { gunzipSync } from "node:zlib";
import { createServer, build, preview } from "vite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});
const servers = [];
const buildDirectory = await mkdtemp(join(tmpdir(), "toggly-vue-browser-"));
async function serve(port, appKey = "", telemetry = true) {
  process.env.VITE_TOGGLY_APP_KEY = appKey;
  process.env.VITE_TOGGLY_ENABLE_TELEMETRY = telemetry ? "true" : "false";
  process.env.VITE_TOGGLY_METRICS_BASE_URL =
    "https://telemetry.test.invalid";
  if (appKey) {
    // Verify the production browser bundle too: a dev-only pass could hide a
    // signature dependency that the production bundler transforms differently.
    await build({
      root,
      mode: "test",
      logLevel: "error",
      build: { outDir: buildDirectory, emptyOutDir: false },
    });
    const server = await preview({
      root,
      mode: "test",
      build: { outDir: buildDirectory },
      preview: { host: "127.0.0.1", port, strictPort: true },
    });
    servers.push({
      close: () => new Promise((resolve) => server.httpServer.close(resolve)),
    });
    return `http://127.0.0.1:${port}`;
  }
  const server = await createServer({
    root,
    mode: "test",
    server: { host: "127.0.0.1", port, strictPort: true },
  });
  await server.listen();
  servers.push(server);
  return `http://127.0.0.1:${port}`;
}
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  const offlineTelemetry = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://telemetry.test.invalid/**", async (route) => {
    offlineTelemetry.push(route.request().url());
    await route.fulfill({ status: 202, body: "" });
  });
  await page.goto(await serve(4173));
  await page.getByTestId("new-ui").waitFor();
  assert.match(await page.getByTestId("missing-key").innerText(), /No App Key/);
  await page.getByTestId("telemetry-evaluate").click();
  await expect(page.getByTestId("telemetry-result")).toContainText(
    "new-dashboard: ON",
  );
  await expect(page.getByTestId("telemetry-usage")).toBeDisabled();
  await page.getByTestId("toggle-new-dashboard").click();
  await page.getByTestId("old-ui").waitFor();
  await page.getByTestId("toggle-new-dashboard").click();
  await page.getByTestId("new-ui").waitFor();
  await page.getByTestId("nonmatching").click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="variant-name"]')?.textContent ===
      "comfortable",
  );
  assert.equal(await page.getByTestId("vip-checkout").count(), 0);
  await page.getByRole("button", { name: "VIP Order", exact: true }).click();
  await page.getByTestId("vip-checkout").waitFor();
  await page.getByTestId("local-toggle").click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="builder-button"]')?.disabled,
  );
  await page.getByTestId("transport-error").click();
  await page.getByRole("alert").waitFor();
  await page.getByTestId("transport-error").click();
  await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `horizontal overflow at ${width}`,
    );
  }
  assert.deepEqual(
    offlineTelemetry,
    [],
    "keyless offline checks and controls never POST telemetry",
  );
  if (process.env.SCREENSHOT_DIR) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: `${process.env.SCREENSHOT_DIR}/vue-desktop.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${process.env.SCREENSHOT_DIR}/vue-mobile.png`,
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  await page.close();

  // Sign exact defs JSON with the protocol's double SHA-256 ES256 digest.
  // Keys are ephemeral test data in memory, never dashboard credentials.
  const keys = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await webcrypto.subtle.exportKey("jwk", keys.publicKey);
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
  Object.assign(jwk, { kid, alg: "ES256", use: "sig" });
  async function envelope(defs) {
    const raw = JSON.stringify(defs),
      timestamp = Math.floor(Date.now() / 1000);
    const hash = await webcrypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${raw}|${timestamp}`),
    );
    const sig = await webcrypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keys.privateKey,
      hash,
    );
    return {
      defs,
      timestamp,
      kid,
      signature: Buffer.from(sig).toString("base64"),
    };
  }
  let tamper = false;
  let failRefresh = false;
  const requests = [];
  const telemetryPackets = [];
  const live = await browser.newPage();
  // Live-update socket delivery is outside this test; do not contact a real
  // WebSocket endpoint with the explicit test-only App Key below.
  await live.addInitScript(() => {
    window.WebSocket = class {
      readyState = 0;
      close() {}
      send() {}
      addEventListener() {}
    };
  });
  await live.route("https://telemetry.test.invalid/**", async (route) => {
    const request = route.request();
    assert.equal(request.method(), "POST");
    const bytes = request.postDataBuffer();
    const body =
      request.headers()["content-encoding"] === "gzip"
        ? gunzipSync(bytes)
        : bytes;
    telemetryPackets.push(JSON.parse(body.toString("utf8")));
    await route.fulfill({ status: 202, body: "" });
  });
  await live.route("https://definitions.toggly.io/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    if (url.pathname.includes("/.well-known/jwks"))
      return route.fulfill({ json: { keys: [jwk] } });
    if (failRefresh)
      return route.fulfill({ status: 503, body: "test refresh failure" });
    const body = await envelope(
      url.pathname.includes("variants")
        ? {
            "new-dashboard": {
              enabled: true,
              variant: "signed",
              configurationValue: { density: "signed" },
            },
          }
        : { "new-dashboard": true, "api-v2": true },
    );
    if (tamper)
      body.signature =
        (body.signature[0] === "A" ? "B" : "A") + body.signature.slice(1);
    await route.fulfill({ json: body });
  });
  await live.goto(await serve(4174, "test-only-not-a-real-key"));
  await live.getByTestId("new-ui").waitFor();
  await live.waitForFunction(
    () =>
      document.querySelector('[data-testid="variant-name"]')?.textContent ===
      "signed",
  );
  const evaluated = requests.filter((u) =>
    u.pathname.includes("/evaluated-signed/"),
  );
  const variants = requests.filter((u) =>
    u.pathname.includes("/evaluated-variants-signed/"),
  );
  assert.equal(evaluated.length, 1);
  assert.equal(variants.length, 1);
  assert.equal(evaluated[0].searchParams.get("u"), "alice");
  assert.deepEqual(evaluated[0].searchParams.getAll("g"), ["beta"]);
  assert.equal(evaluated[0].searchParams.get("claim.role"), "admin");
  await live.getByTestId("telemetry-evaluate").click();
  await expect(live.getByTestId("telemetry-result")).toContainText(
    "new-dashboard: ON",
  );
  await live.getByTestId("telemetry-usage").click();
  const evaluatedBeforeExplicitEvents = requests.filter((url) =>
    url.pathname.includes("/evaluated-signed/"),
  ).length;
  await live.getByTestId("telemetry-view").click();
  await live.getByTestId("telemetry-counter").click();
  await live.getByTestId("telemetry-gauge").click();
  await live.getByTestId("telemetry-flush").click();
  await expect.poll(() => telemetryPackets.length).toBe(2);
  assert.equal(
    requests.filter((url) => url.pathname.includes("/evaluated-signed/")).length,
    evaluatedBeforeExplicitEvents,
    "explicit telemetry actions do not trigger additional feature checks",
  );
  const mainPacket = telemetryPackets.find((packet) => packet.m);
  const variantPacket = telemetryPackets.find(
    (packet) => packet.f?.["new-dashboard"] && !packet.m,
  );
  assert.ok(mainPacket, "the plugin-owned main service sends explicit events");
  assert.ok(variantPacket, "the separate keyed variant service sends checks");
  assert.equal(mainPacket.k, "test-only-not-a-real-key");
  assert.equal(mainPacket.e, "Production");
  assert.equal(mainPacket.u, "alice");
  const mainFeature = mainPacket.f["new-dashboard"];
  assert.ok(mainFeature.enabled[0] > 0, "main-service checks are automatic");
  assert.equal(mainFeature.signed[1], 1, "usage uses the selected variant");
  assert.equal(mainFeature.signed[2], 1, "view uses the selected variant");
  assert.deepEqual(mainPacket.m, {
    "sample-actions": 1,
    "sample-cart-size": 3,
  });
  const variantFeature = Object.values(variantPacket.f["new-dashboard"])[0];
  assert.ok(variantFeature[0] > 0, "variant-service checks are automatic");
  assert.equal(variantPacket.u, "alice");
  tamper = true;
  await live.getByTestId("nonmatching").click();
  await live.getByRole("alert").waitFor();
  await live.getByTestId("old-ui").waitFor();
  assert.equal(
    await live.getByTestId("new-ui").count(),
    0,
    "tampered signed ON payload must not enable UI",
  );
  await live.close();

  tamper = false;
  const optedOut = await browser.newPage();
  const optedOutPackets = [];
  await optedOut.addInitScript(() => {
    window.WebSocket = class {
      readyState = 0;
      close() {}
      send() {}
      addEventListener() {}
    };
  });
  await optedOut.route("https://telemetry.test.invalid/**", async (route) => {
    optedOutPackets.push(route.request().url());
    await route.fulfill({ status: 202, body: "" });
  });
  await optedOut.route("https://definitions.toggly.io/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/.well-known/jwks"))
      return route.fulfill({ json: { keys: [jwk] } });
    const body = await envelope(
      url.pathname.includes("variants")
        ? {
            "new-dashboard": {
              enabled: true,
              variant: "signed",
              configurationValue: { density: "signed" },
            },
          }
        : { "new-dashboard": true, "api-v2": true },
    );
    return route.fulfill({ json: body });
  });
  await optedOut.goto(await serve(4175, "test-only-not-a-real-key", false));
  await optedOut.getByTestId("new-ui").waitFor();
  await optedOut.getByTestId("telemetry-evaluate").click();
  await expect(optedOut.getByTestId("telemetry-result")).toContainText(
    "new-dashboard: ON",
  );
  await expect(optedOut.getByTestId("telemetry-usage")).toBeDisabled();
  await expect(optedOut.getByTestId("telemetry-flush")).toBeDisabled();
  assert.deepEqual(
    optedOutPackets,
    [],
    "opt-out preserves evaluations and prevents telemetry POSTs",
  );
  await optedOut.close();
  console.log(
    "Browser checks passed: offline/keyless silence, enabled dual-client telemetry packets, opt-out silence, mobile layout, signed definitions and tamper rejection",
  );
} finally {
  await browser.close();
  await Promise.all(servers.map((s) => s.close()));
  await rm(buildDirectory, { recursive: true, force: true });
}
