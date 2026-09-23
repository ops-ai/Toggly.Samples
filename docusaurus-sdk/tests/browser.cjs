const { chromium, expect } = require("@playwright/test");
const { webcrypto, createHash } = require("node:crypto");
const { gunzipSync } = require("node:zlib");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const catalog = require("../src/sample/catalog.cjs");
const root = path.resolve(__dirname, "..");
async function expectNativeReady(page, enabled) {
  // Feature branches exist in SSR HTML. The native hook only reports ON/OFF
  // after provider evaluation, so wait for that before trusting or clicking UI.
  const value = enabled ? "ON" : "OFF";
  await expect(page.getByTestId("native-hook")).toHaveText(
    `Native useFlag: ${value}`,
  );
  await expect(page.getByTestId("toggle-new-dashboard")).toHaveText(
    `new-dashboard: ${value}`,
  );
}
(async () => {
  const output = fs.mkdtempSync(
    path.join(os.tmpdir(), "toggly-docusaurus-browser-"),
  );
  let site;
  const server = http.createServer((req, res) => {
    let name = new URL(req.url, "http://localhost").pathname;
    let file = path.join(site, name);
    try {
      if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      const ext = path.extname(file);
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".json": "application/json",
          ".css": "text/css",
        }[ext] || "application/octet-stream",
      );
      res.end(fs.readFileSync(file));
    } catch {
      res.statusCode = 404;
      res.end("missing");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  let browser;
  function build(name, key, telemetry = true) {
    site = path.join(output, name);
    execFileSync(
      process.execPath,
      [
        path.join(root, "node_modules/@docusaurus/core/bin/docusaurus.mjs"),
        "build",
        "--out-dir",
        site,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          TOGGLY_APP_KEY: key,
          TOGGLY_ENVIRONMENT: "Production",
          TOGGLY_ENABLE_TELEMETRY: telemetry ? "true" : "false",
        },
        stdio: "inherit",
      },
    );
  }
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
        : {}),
    });
    build("offline", "");
    const page = await browser.newPage();
    const errors = [];
    const offlineTelemetry = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route("https://metrics.toggly.io/**", async (route) => {
      offlineTelemetry.push(route.request().url());
      await route.fulfill({ status: 202, body: "" });
    });
    await page.goto(url);
    await expectNativeReady(page, true);
    await page.getByTestId("new-ui").waitFor();
    assert.match(await page.getByTestId("mode").innerText(), /No App Key/);
    await page.getByTestId("toggle-new-dashboard").click();
    await expectNativeReady(page, false);
    await page.getByTestId("old-ui").waitFor();
    await expect(page.getByTestId("new-ui")).not.toBeVisible();
    assert.match(await page.getByTestId("native-hook").innerText(), /OFF/);
    assert.match(await page.getByTestId("all").innerText(), /OFF/);
    assert.match(await page.getByTestId("any").innerText(), /ON/);
    await page
      .getByRole("button", { name: "Check submit", exact: true })
      .click();
    assert.match(
      await page.getByTestId("action-result").innerText(),
      /allowed/,
    );
    await page
      .getByRole("button", { name: "Device prerequisite: ready", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Check submit", exact: true })
      .click();
    assert.match(await page.getByTestId("action-result").innerText(), /denied/);
    await page
      .getByRole("button", { name: "Standard Order", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="order-result"]')
        ?.textContent.includes("OFF"),
    );
    await page
      .getByRole("button", { name: "Matching · alice", exact: true })
      .click();
    await page.getByRole("button", { name: "VIP Order", exact: true }).click();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="order-result"]')
        ?.textContent.includes("ON"),
    );
    await page
      .getByRole("button", { name: "Non-matching · bob", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="filter-targeting"]')
        ?.textContent.endsWith("OFF"),
    );
    assert.equal(await page.locator("tbody tr").count(), 11);
    await page
      .getByRole("button", { name: "Exercise safe OFF defaults", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="toggle-api-v2"]')
        ?.textContent.endsWith("OFF"),
    );
    await page
      .getByRole("button", { name: "Restore recorded defaults", exact: true })
      .click();
    await page.getByTestId("record-telemetry").click();
    await expect(page.getByTestId("telemetry-status")).toContainText(
      "No telemetry reporter",
    );
    assert.deepEqual(
      offlineTelemetry,
      [],
      "keyless mode must not send frontend telemetry",
    );
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      if (process.env.SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({
          path: path.join(
            process.env.SCREENSHOT_DIR,
            "docusaurus-" + width + ".png",
          ),
          fullPage: true,
        });
      }
    }
    await page.goto(url + "/docs/beta");
    await page
      .getByText("New documentation visible", { exact: true })
      .waitFor();
    // Both MDX branches are present during SSR; only hydration removes negate.
    await expect(
      page.getByText("Existing documentation visible", { exact: true }),
    ).not.toBeVisible();
    assert.deepEqual(errors, []);
    await page.close();
    // Production browser proof keeps the real native signature verifier. Only HTTP
    // and WebSocket delivery are test-controlled; no SDK module is mocked.
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

    build("live", "test-only-docusaurus");
    let enabled = true,
      entityEnabled = true,
      tamper = false,
      fail = false;
    const requests = [];
    const telemetryPackets = [];
    const telemetryRequests = [];
    function decodeTelemetry(request) {
      const bytes = request.postDataBuffer();
      const body =
        request.headers()["content-encoding"] === "gzip"
          ? gunzipSync(bytes)
          : bytes;
      return JSON.parse(body.toString("utf8"));
    }
    async function livePage() {
      const context = await browser.newContext();
      await context.addInitScript(() => {
        window.WebSocket = class {
          close() {}
          send() {}
          addEventListener() {}
        };
      });
      await context.route("https://metrics.toggly.io/**", async (route) => {
        const request = route.request();
        assert.equal(request.method(), "POST");
        telemetryRequests.push({
          headers: request.headers(),
          url: request.url(),
        });
        telemetryPackets.push(decodeTelemetry(request));
        await route.fulfill({ status: 202, body: "" });
      });
      const p = await context.newPage();
      await p.route("https://definitions.toggly.io/**", async (route) => {
        const requestUrl = new URL(route.request().url());
        requests.push(requestUrl);
        if (requestUrl.pathname.includes("/.well-known/jwks"))
          return route.fulfill({ json: { keys: [jwk] } });
        if (fail) return route.fulfill({ status: 503, body: "offline" });
        const body = await envelope({
          ...Object.fromEntries(catalog.allKeys.map((k) => [k, enabled])),
          ExpressCheckout: entityEnabled ? catalog.orderGate : false,
          "filter-context-property": entityEnabled ? catalog.orderGate : false,
        });
        if (tamper)
          body.signature =
            (body.signature[0] === "A" ? "B" : "A") + body.signature.slice(1);
        return route.fulfill({ json: body });
      });
      await p.goto(url);
      return { p, context };
    }
    let { p, context } = await livePage();
    await expectNativeReady(p, true);
    await p.getByTestId("new-ui").waitFor();
    await p.waitForFunction(() =>
      document
        .querySelector('[data-testid="order-result"]')
        ?.textContent.includes("ON"),
    );
    await p.getByRole("button", { name: "Standard Order", exact: true }).click();
    await expect(p.getByTestId("order-result")).toContainText("OFF");
    await p.getByRole("button", { name: "VIP Order", exact: true }).click();
    await expect(p.getByTestId("order-result")).toContainText("ON");
    await p.getByTestId("flush-order-telemetry").click();
    const beforeEntityRefresh = telemetryPackets.length;
    entityEnabled = false;
    await expect(p.getByTestId("order-result")).toContainText("OFF");
    await p.getByTestId("flush-order-telemetry").click();
    await expect.poll(() =>
      telemetryPackets.slice(beforeEntityRefresh).some(
        (packet) => packet.f?.ExpressCheckout?.disabled?.[0] > 0,
      ),
    ).toBe(true);
    entityEnabled = true;
    await expect(p.getByTestId("order-result")).toContainText("ON");
    await expect.poll(() =>
      telemetryPackets.some((packet) => packet.f?.["beta-access"]),
    ).toBe(true);
    await p.getByTestId("flush-telemetry").click();
    await expect.poll(() => telemetryPackets.length).toBeGreaterThan(0);
    const beforeExplicit = telemetryPackets.length;
    await p.getByTestId("record-telemetry").click();
    await expect(p.getByTestId("telemetry-status")).toContainText(
      "Flush attempted",
    );
    const explicitPacket = () =>
      telemetryPackets.slice(beforeExplicit).find(
        (packet) =>
          packet.f?.["docusaurus-workshop"]?.workshop &&
          packet.m?.["docusaurus-sample-actions"] === 2,
      );
    await expect.poll(() => Boolean(explicitPacket())).toBe(true);
    const explicit = explicitPacket();
    assert.ok(explicit, "provider owner sends explicit feature and metric events");
    assert.equal(explicit.k, "test-only-docusaurus");
    assert.equal(explicit.e, "Production");
    assert.deepEqual(explicit.f["docusaurus-workshop"].workshop, [0, 1, 1]);
    assert.deepEqual(explicit.m, {
      "docusaurus-sample-actions": 2,
      "docusaurus-sample-gauge": 3,
    });
    assert.ok(
      telemetryRequests.every(
        (request) =>
          request.url ===
            "https://metrics.toggly.io/api/frontend/telemetry" &&
          !request.headers.cookie &&
          !request.headers.authorization,
      ),
      "frontend telemetry uses the metrics endpoint without credentials",
    );
    assert(
      requests.filter((u) => u.searchParams.get("u") === "alice").length >= 2,
    );
    assert(
      requests.every(
        (u) => !u.searchParams.has("g") && !u.searchParams.has("claim.role"),
      ),
    );
    await p.getByRole("link", { name: "Beta guide", exact: true }).click();
    await p.getByText("New documentation visible", { exact: true }).waitFor();
    await expect(
      p.getByText("Existing documentation visible", { exact: true }),
    ).not.toBeVisible();
    await p.getByRole("link", { name: "Workshop", exact: true }).click();
    await expectNativeReady(p, true);
    // No sample control runs: background SDK polling must change native UI and all
    // displayed results together. This is HTTP polling, not proof of socket delivery.
    enabled = false;
    await p.getByTestId("old-ui").waitFor();
    await p.waitForFunction(() =>
      document
        .querySelector('[data-testid="toggle-new-dashboard"]')
        ?.textContent.endsWith("OFF"),
    );
    await p.waitForFunction(() =>
      document
        .querySelector('[data-testid="filter-always-on"]')
        ?.textContent.endsWith("OFF"),
    );
    await p.getByRole("button", { name: "Check submit", exact: true }).click();
    assert.match(await p.getByTestId("action-result").innerText(), /denied/);
    await p.goto(url + "/docs/beta");
    await p.getByText("Existing documentation visible", { exact: true }).waitFor();
    await expect(
      p.getByText("New documentation visible", { exact: true }),
    ).not.toBeVisible();
    await p.goto(url);
    await expectNativeReady(p, false);
    await p
      .getByRole("button", { name: "Non-matching · bob", exact: true })
      .click();
    await expect.poll(() =>
      telemetryPackets.some(
        (packet) =>
          packet.f?.ExpressCheckout ||
          packet.f?.["filter-context-property"],
      ),
    ).toBe(true);
    await p.waitForTimeout(300);
    const before = requests.filter(
      (u) => u.searchParams.get("u") === "alice",
    ).length;
    await p.waitForTimeout(1400);
    assert.equal(
      requests.filter((u) => u.searchParams.get("u") === "alice").length,
      before,
      "old provider/core polling must be cleaned up",
    );
    assert(requests.some((u) => u.searchParams.get("u") === "bob"));
    await context.close();
    const observedFields = [
      ...new Set(telemetryPackets.flatMap((packet) => Object.keys(packet))),
    ].sort();
    assert.ok(
      observedFields.every((field) =>
        ["k", "e", "f", "m", "i", "u"].includes(field),
      ),
      "telemetry packets use only compact contract fields",
    );
    const observedAttribution = telemetryPackets.map((packet) =>
      Object.fromEntries(
        ["i", "u"]
          .filter((field) => Object.hasOwn(packet, field))
          .map((field) => [field, packet[field]]),
      ),
    );
    console.log(
      "Observed public Docusaurus telemetry fields:",
      JSON.stringify({ observedFields, attribution: observedAttribution }),
    );
    build("optout", "test-only-docusaurus", false);
    const optOutPackets = [];
    const optOutContext = await browser.newContext();
    await optOutContext.addInitScript(() => {
      window.WebSocket = class {
        close() {}
        send() {}
        addEventListener() {}
      };
    });
    await optOutContext.route("https://metrics.toggly.io/**", async (route) => {
      optOutPackets.push(decodeTelemetry(route.request()));
      await route.fulfill({ status: 202, body: "" });
    });
    await optOutContext.route("https://definitions.toggly.io/**", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname.includes("/.well-known/jwks"))
        return route.fulfill({ json: { keys: [jwk] } });
      return route.fulfill({
        json: await envelope(
          Object.fromEntries(catalog.allKeys.map((key) => [key, true])),
        ),
      });
    });
    const optOutPage = await optOutContext.newPage();
    await optOutPage.goto(url);
    await expectNativeReady(optOutPage, true);
    await optOutPage.getByTestId("record-telemetry").click();
    await expect(optOutPage.getByTestId("telemetry-status")).toContainText(
      "Telemetry disabled",
    );
    await optOutPage.waitForTimeout(100);
    assert.deepEqual(optOutPackets, [], "opt-out sends no telemetry packets");
    await optOutContext.close();
    site = path.join(output, "live");
    for (const mode of ["tamper", "failure"]) {
      tamper = mode === "tamper";
      fail = mode === "failure";
      enabled = true;
      ({ p, context } = await livePage());
      await expectNativeReady(p, false);
      await p.getByTestId("old-ui").waitFor();
      await p.waitForFunction(() =>
        document
          .querySelector('[data-testid="order-result"]')
          ?.textContent.includes("OFF"),
      );
      assert.equal(await p.getByTestId("new-ui").count(), 0);
      await context.close();
    }
    console.log(
      "PASS: native gates/core, offline/mobile/MDX, signed/tampered/defaults, initial identity, background snapshot agreement and old-session cleanup",
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(output, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
