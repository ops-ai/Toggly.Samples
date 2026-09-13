const { chromium, expect } = require("@playwright/test");
const { webcrypto, createHash } = require("node:crypto");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
(async () => {
  const output = fs.mkdtempSync(
    path.join(os.tmpdir(), "toggly-angular-browser-"),
  );
  let site, browser;
  const server = http.createServer((req, res) => {
    let file = path.join(site, new URL(req.url, "http://localhost").pathname);
    try {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
        file = path.join(site, "index.html");
      const ext = path.extname(file);
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
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
  function build(name, key) {
    const env = {
      ...process.env,
      TOGGLY_APP_KEY: key,
      TOGGLY_ENVIRONMENT: "Production",
    };
    execFileSync(process.execPath, ["scripts/configure.cjs"], {
      cwd: root,
      env,
    });
    execFileSync(
      process.execPath,
      [
        "node_modules/@angular/cli/bin/ng.js",
        "build",
        "--output-path",
        path.join(output, name),
      ],
      { cwd: root, env, stdio: "inherit" },
    );
    site = path.join(output, name, "browser");
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
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(url);
    assert.equal(
      await page.evaluate(() => typeof window.Zone),
      "undefined",
      "the Angular 22 sample must execute without Zone.js",
    );
    await expect(page.getByTestId("toggle-new-dashboard")).toHaveText(
      "new-dashboard: ON",
    );
    await page.getByTestId("native-component").waitFor();
    await page.getByTestId("native-directive").waitFor();
    await page.getByTestId("variant-compact").waitFor();
    assert.match(await page.getByTestId("mode").innerText(), /No App Key/);
    await page.getByTestId("toggle-new-dashboard").click();
    await expect(page.getByTestId("toggle-new-dashboard")).toHaveText(
      "new-dashboard: OFF",
    );
    await page.getByTestId("old-ui").waitFor();
    await expect(page.getByTestId("native-component")).not.toBeVisible();
    await expect(page.getByTestId("native-directive")).not.toBeVisible();
    await expect(page.getByTestId("all")).not.toBeVisible();
    await page.getByTestId("any").waitFor();
    await page
      .getByRole("button", { name: "Check submit", exact: true })
      .click();
    await expect(page.getByTestId("action-result")).toContainText("allowed");
    await page
      .getByRole("button", { name: "Device prerequisite: ready", exact: true })
      .click();
    await expect(page.getByTestId("builder")).toBeDisabled();
    await page
      .getByRole("button", { name: "Check submit", exact: true })
      .click();
    await expect(page.getByTestId("action-result")).toContainText("denied");
    await page.getByTestId("toggle-enhanced-submit").click();
    await page
      .getByRole("button", {
        name: "Device prerequisite: not ready",
        exact: true,
      })
      .click();
    await expect(page.getByTestId("builder")).toBeDisabled();
    await page
      .getByRole("button", { name: "Observe submit once", exact: true })
      .click();
    await expect(page.getByTestId("observable-result")).toContainText("OFF");
    await page
      .getByRole("button", { name: "Standard Order", exact: true })
      .click();
    await expect(page.getByTestId("order-builder")).toBeDisabled();
    await expect(page.getByTestId("order-component")).not.toBeVisible();
    await expect(page.getByTestId("order-directive")).not.toBeVisible();
    await page.getByRole("button", { name: "VIP Order", exact: true }).click();
    await page.getByTestId("order-component").waitFor();
    await expect(page.getByTestId("order-builder")).toBeEnabled();
    await page.getByTestId("toggle-new-dashboard").click();
    await expect(page.getByTestId("toggle-new-dashboard")).toContainText("ON");
    await page
      .getByRole("button", { name: "Non-matching · bob", exact: true })
      .click();
    await page.getByTestId("variant-comfortable").waitFor();
    await expect(page.getByTestId("filter-targeting")).toContainText("OFF");
    assert.equal(await page.locator("tbody tr").count(), 11);
    await page.getByTestId("toggle-beta-access").click();
    await expect(page.getByTestId("toggle-beta-access")).toContainText("OFF");
    await page.getByTestId("beta-link").click();
    await expect(page).toHaveURL(url + "/");
    await page.getByTestId("toggle-beta-access").click();
    await page.getByTestId("beta-link").click();
    await page.getByTestId("beta-page").waitFor();
    await page
      .getByRole("link", { name: "Return to workshop", exact: true })
      .click();
    await page.getByTestId("variant-comfortable").waitFor();
    await page
      .getByRole("button", {
        name: "Simulate fixture transport failure",
        exact: true,
      })
      .click();
    await page.getByRole("alert").waitFor();
    await expect(page.getByTestId("toggle-new-dashboard")).toContainText("ON");
    await page
      .getByRole("button", { name: "Recover fixture transport", exact: true })
      .click();
    await page.getByTestId("native-component").waitFor();
    await expect(page.getByTestId("toggle-new-dashboard")).toContainText("ON");
    await expect(page.getByRole("alert")).toContainText(
      "retains this diagnostic",
    );
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => scrollTo(0, 0));
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
            "angular-" + width + ".png",
          ),
          fullPage: true,
        });
      }
    }
    assert.deepEqual(errors, []);
    await page.close();
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

    build("live", "test-only-angular");
    let enabled = true,
      tamper = false,
      fail = false,
      assigned = "compact";
    const requests = [];
    const orderGate = {
      requirement: "all",
      rules: [{ property: "Vip", op: "eq", value: "true", type: "boolean" }],
    };
    async function livePage() {
      const context = await browser.newContext();
      await context.addInitScript(() => {
        window.__testSockets = [];
        window.WebSocket = class {
          static OPEN = 1;
          readyState = 1;
          onmessage;
          onopen;
          constructor(url) {
            this.url = url;
            window.__testSockets.push(this);
            queueMicrotask(() => this.onopen?.({}));
          }
          close() {
            this.readyState = 3;
          }
          send() {}
          addEventListener() {}
        };
      });
      const p = await context.newPage();
      await p.route("https://definitions.toggly.io/**", async (route) => {
        const u = new URL(route.request().url());
        requests.push(u);
        if (u.pathname.includes("/.well-known/jwks"))
          return route.fulfill({ json: { keys: [jwk] } });
        if (fail) return route.fulfill({ status: 503, body: "offline" });
        const flags = {
          "new-dashboard": enabled,
          "api-v2": true,
          "enhanced-submit": enabled,
          "beta-access": enabled,
          "filter-always-on": enabled,
          ExpressCheckout: orderGate,
          "filter-context-property": orderGate,
        };
        const defs = u.pathname.includes("variants")
          ? {
              "new-dashboard": {
                enabled,
                variant: assigned,
                configurationValue: { density: assigned },
              },
            }
          : flags;
        const body = await envelope(defs);
        if (tamper)
          body.signature =
            (body.signature[0] === "A" ? "B" : "A") + body.signature.slice(1);
        return route.fulfill({ json: body });
      });
      await p.goto(url);
      return { p, context };
    }
    let { p, context } = await livePage();
    await p.getByTestId("native-component").waitFor();
    await p.getByTestId("native-directive").waitFor();
    await p.getByTestId("variant-compact").waitFor();
    await expect(p.getByTestId("toggle-new-dashboard")).toHaveText(
      "new-dashboard: ON",
    );
    for (const endpoint of ["evaluated-signed", "evaluated-variants-signed"]) {
      const initial = requests.filter((u) =>
        u.pathname.includes("/" + endpoint + "/"),
      );
      assert.equal(initial.length, 1);
      assert.equal(
        initial[0].searchParams.get(
          endpoint.includes("variants") ? "userId" : "u",
        ),
        "alice",
      );
      assert.deepEqual(initial[0].searchParams.getAll("g"), ["beta"]);
      assert.equal(initial[0].searchParams.get("claim.role"), "admin");
    }
    async function notify(revision) {
      await p.evaluate(
        (revision) =>
          window.__testSockets
            .filter((s) => s.readyState === 1)
            .forEach((s) =>
              s.onmessage?.({
                data: JSON.stringify({ type: "flags-updated", etag: revision }),
              }),
            ),
        revision,
      );
    }
    // Real SDK message handling and refresh subscriptions; only socket transport is
    // simulated. No sample control refreshes the checklist or variant for this test.
    enabled = false;
    await notify("r2");
    await expect(p.getByTestId("toggle-new-dashboard")).toHaveText(
      "new-dashboard: OFF",
    );
    await expect(p.getByTestId("native-component")).not.toBeVisible();
    await expect(p.getByTestId("native-directive")).not.toBeVisible();
    await expect(p.getByTestId("filter-always-on")).toContainText("OFF");
    await expect(p.getByTestId("variant-name")).toContainText("None");
    enabled = true;
    assigned = "comfortable";
    await notify("r3");
    await p.getByTestId("native-component").waitFor();
    await p.getByTestId("variant-comfortable").waitFor();
    const before = requests.filter((u) =>
      u.pathname.includes("/evaluated"),
    ).length;
    await p
      .getByRole("button", { name: "Non-matching · bob", exact: true })
      .click();
    await expect(p.getByTestId("identity")).toContainText("bob");
    await expect
      .poll(
        () => requests.filter((u) => u.pathname.includes("/evaluated")).length,
      )
      .toBe(before + 2);
    const last = requests
      .filter((u) => u.pathname.includes("/evaluated"))
      .slice(-2);
    for (const u of last) {
      assert.equal(
        u.searchParams.get(u.pathname.includes("variants") ? "userId" : "u"),
        "bob",
      );
      assert.equal(u.searchParams.get("claim.role"), "user");
    }
    await p.getByTestId("beta-link").click();
    await p.getByTestId("beta-page").waitFor();
    assert.equal(
      await p.evaluate(
        () => window.__testSockets.filter((s) => s.readyState === 1).length,
      ),
      1,
      "scoped variant service closes its socket when panel unmounts",
    );
    await context.close();
    for (const mode of ["tamper", "failure"]) {
      tamper = mode === "tamper";
      fail = mode === "failure";
      ({ p, context } = await livePage());
      await expect(p.getByTestId("toggle-new-dashboard")).toHaveText(
        "new-dashboard: OFF",
      );
      await expect(p.getByTestId("native-component")).not.toBeVisible();
      await expect(p.getByTestId("native-directive")).not.toBeVisible();
      await p.getByRole("alert").waitFor();
      await context.close();
    }
    console.log(
      "PASS native Angular component/directive/builder/guard/variants, offline/mobile, full initial context, signed/tamper/defaults, background sockets/snapshots and scoped cleanup",
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
