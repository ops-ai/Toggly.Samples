// Browser tests use the published SDK and real browser WebCrypto. Only network
// transport is faked. No private SDK fields or sample-only substitute gates.
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { chromium } from "@playwright/test";
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
async function serve(port, appKey = "") {
  process.env.VITE_TOGGLY_APP_KEY = appKey;
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
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(await serve(4173));
  await page.getByTestId("new-ui").waitFor();
  assert.match(await page.getByTestId("missing-key").innerText(), /No App Key/);
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
  const requests = [];
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
  await live.route("https://definitions.toggly.io/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
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
  console.log(
    "Browser checks passed: offline controls/mobile layout, production-bundle signed SDK responses, tamper rejection, initial context",
  );
} finally {
  await browser.close();
  await Promise.all(servers.map((s) => s.close()));
  await rm(buildDirectory, { recursive: true, force: true });
}
