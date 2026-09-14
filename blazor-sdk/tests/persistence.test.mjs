// Credential-free integration: real signed local HTTP fixtures, public SDK,
// persisted bytes, new OS hosts and actual interactive Server circuits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdtemp,
  readdir,
  readFile,
  writeFile,
  cp,
  rm,
  stat,
  realpath,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { chromium } from "playwright";
const appKey = "local-only-persistence-fixture";
const environment = "PersistenceTest";
const published = resolve(process.env.PUBLISHED_DIRECTORY ?? "published");
const dotnet = process.env.DOTNET_HOST_PATH ?? "dotnet";
const hash = (value) => createHash("sha256").update(value).digest();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), sleep(5000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([once(child, "exit"), sleep(3000)]);
  }
  assert.ok(
    child.exitCode !== null || child.signalCode !== null,
    "owned host must exit",
  );
}
async function availablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function launch(
  directory,
  source,
  key = appKey,
  env = environment,
  offline = true,
) {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(dotnet, ["BlazorSample.dll", "--urls", origin], {
    cwd: published,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      DOTNET_ROOT: process.env.DOTNET_ROOT,
      ASPNETCORE_ENVIRONMENT: "Production",
      TOGGLY_APP_KEY: key,
      TOGGLY_FRONTEND_APP_KEY: "",
      TOGGLY_ENVIRONMENT: env,
      TOGGLY_SNAPSHOT_DIRECTORY: directory,
      TOGGLY_DEFINITIONS_URL: source,
      TOGGLY_NETWORK_MODE: offline ? "offline" : "online",
      // Local proxy rejects any accidental non-local request, including baseline
      // code that does not yet understand the Sample configuration variables.
      HTTP_PROXY: source,
      HTTPS_PROXY: source,
      ALL_PROXY: source,
      NO_PROXY: "127.0.0.1,localhost",
      Logging__LogLevel__Default: "None",
    },
    stdio: "ignore",
  });
  try {
    for (let i = 0; i < 100; i++) {
      assert.equal(child.exitCode, null, "host exited before readiness");
      try {
        if ((await fetch(`${origin}/public-toggly.json`)).ok)
          return { child, origin };
      } catch {}
      await sleep(100);
    }
    throw new Error("host readiness deadline");
  } catch (error) {
    await stop(child);
    throw error;
  }
}
async function dashboard(browser, origin, expected) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    // Missing definitions retain the public SDK’s per-feature startup wait.
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);
    let circuit = false;
    page.on("websocket", (socket) => {
      if (new URL(socket.url()).pathname === "/_blazor") circuit = true;
    });
    const response = await page.goto(`${origin}/server/identity`);
    assert.equal(response.status(), 200);
    await page.getByRole("button", { name: "Matching", exact: true }).waitFor();
    await page
      .locator("button:enabled")
      .filter({ hasText: /^Matching$/ })
      .waitFor();
    if (expected) {
      await page.getByRole("button", { name: "Matching", exact: true }).click();
      await page
        .getByTestId("targeting")
        .filter({ hasText: "Targeting ON" })
        .waitFor();
      await page
        .getByRole("button", { name: "Non-matching", exact: true })
        .click();
      await page
        .getByTestId("targeting")
        .filter({ hasText: "Targeting OFF" })
        .waitFor();
      await page
        .locator('nav[aria-label="Workshop sections"] a[href="/server/entity"]')
        .click();
      await page
        .getByTestId("vip")
        .filter({ hasText: "VIP express checkout ON" })
        .waitFor();
      await page
        .getByTestId("standard")
        .filter({ hasText: "Standard express checkout OFF" })
        .waitFor();
    }
    await page
      .locator('nav[aria-label="Workshop sections"] a[href="/server/home"]')
      .click();
    const cell = page.getByTestId("dashboard");
    await cell
      .filter({
        hasText: expected ? "New dashboard enabled" : "Classic dashboard",
      })
      .waitFor({ timeout: 120000 });
    assert.equal(await cell.count(), 1);
    assert.equal(
      circuit,
      true,
      "a real interactive Server circuit rendered the result",
    );
  } finally {
    await context.close();
  }
}

test(
  "signed snapshots survive fresh Server processes and invalid storage fails closed",
  { timeout: 600000 },
  async () => {
    const root = await mkdtemp(
      join(await realpath(tmpdir()), "toggly-persistence-test-"),
    );
    const warm = join(root, "warm");
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const jwk = publicKey.export({ format: "jwk" });
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
    const defs = JSON.stringify([
      {
        featureKey: "new-dashboard",
        filters: [{ name: "AlwaysOn", parameters: {} }],
      },
      {
        featureKey: "filter-targeting",
        filters: [
          {
            name: "Microsoft.Targeting",
            parameters: {
              "Audience:Users:0": "alice",
              "Audience:DefaultRolloutPercentage": "0",
            },
          },
        ],
      },
      {
        featureKey: "ExpressCheckout",
        contextKind: "Order",
        filters: [
          {
            name: "ContextProperty",
            parameters: {
              Property: "Vip",
              Operator: "eq",
              Value: "true",
              ValueType: "boolean",
            },
          },
        ],
      },
    ]);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = sign("sha256", hash(`${defs}|${timestamp}`), {
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    }).toString("base64");
    const body = `{"defs":${defs},"timestamp":${timestamp},"signature":"${signature}","kid":"${kid}"}`;
    let signedRequests = 0;
    const source = createServer((request, response) => {
      response.setHeader("content-type", "application/json");
      if (request.url === "/.well-known/jwks")
        response.end(
          JSON.stringify({ keys: [{ ...jwk, kid, alg: "ES256", use: "sig" }] }),
        );
      else if (request.url.startsWith("/definitions-signed/")) {
        signedRequests++;
        response.end(body);
      } else {
        response.statusCode = 503;
        response.end("{}");
      }
    });
    source.on("connect", (_req, socket) => socket.destroy());
    source.on("upgrade", (_req, socket) => socket.destroy());
    source.listen(0, "127.0.0.1");
    await once(source, "listening");
    const sourceUrl = `http://127.0.0.1:${source.address().port}/`;
    const browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
        : {}),
    });
    let host;
    try {
      host = await launch(warm, sourceUrl, appKey, environment, false);
      console.log("local-signed-persistence: warm-host-started");
      // Resolve the real trusted provider via an SSR request before inspecting storage.
      await fetch(`${host.origin}/ssr/home`, {
        signal: AbortSignal.timeout(20000),
      });
      console.log("local-signed-persistence: warm-ssr-rendered");
      // Missing adapter is detected by this durable-write assertion before UI.
      let files = [];
      for (let i = 0; i < 100; i++) {
        try {
          files = await readdir(warm, { recursive: true });
        } catch {}
        if (files.some((file) => file.endsWith("definitions.json"))) break;
        await sleep(100);
      }
      assert.ok(
        files.some((file) => file.endsWith("definitions.json")),
        "signed online warm must persist definitions",
      );
      await dashboard(browser, host.origin, true);
      assert.ok(
        signedRequests > 0,
        "warm actually obtained signed HTTP definitions",
      );
      await stop(host.child);
      host = null;
      await new Promise((resolve) => {
        source.close(resolve);
        source.closeAllConnections();
      });
      const namespace = (await readdir(warm))[0];
      const definitions = join(warm, namespace, "definitions.json");
      const jwks = join(warm, namespace, "jwks.json");
      const record = JSON.parse(await readFile(definitions, "utf8"));
      assert.equal(
        record.Value.SignedDefsJson,
        defs,
        "retain exact signed bytes",
      );
      for (const path of [definitions, jwks]) {
        assert.ok(
          !(await readFile(path, "utf8")).includes(appKey),
          "no credential in persisted record",
        );
        if (process.platform !== "win32")
          assert.equal((await stat(path)).mode & 0o777, 0o600);
      }
      assert.equal(
        files.filter((file) => file.endsWith(".tmp")).length,
        0,
        "atomic writes leave no temporary files",
      );
      const cases = [
        ["cold-valid", async () => {}, appKey, environment, true],
        [
          "wrong-app",
          async () => {},
          "another-local-fixture",
          environment,
          false,
        ],
        [
          "wrong-environment",
          async () => {},
          appKey,
          "AnotherEnvironment",
          false,
        ],
        [
          "corrupt-signature",
          async (path) => {
            const data = JSON.parse(await readFile(path, "utf8"));
            data.Value.Signature = Buffer.alloc(64).toString("base64");
            await writeFile(path, JSON.stringify(data));
          },
          appKey,
          environment,
          false,
        ],
        [
          "corrupt-signed-payload",
          async (path) => {
            const data = JSON.parse(await readFile(path, "utf8"));
            data.Value.SignedDefsJson = data.Value.SignedDefsJson.replace(
              "AlwaysOn",
              "NeverOn",
            );
            await writeFile(path, JSON.stringify(data));
          },
          appKey,
          environment,
          false,
        ],
        [
          "wrong-record-namespace",
          async (path) => {
            const data = JSON.parse(await readFile(path, "utf8"));
            data.Namespace = "wrong";
            await writeFile(path, JSON.stringify(data));
          },
          appKey,
          environment,
          false,
        ],
        [
          "malformed",
          async (path) => writeFile(path, "{broken"),
          appKey,
          environment,
          false,
        ],
        [
          "oversized",
          async (path) => writeFile(path, " ".repeat(4 * 1024 * 1024 + 1)),
          appKey,
          environment,
          false,
        ],
        [
          "missing-jwks",
          async (path) => rm(join(path, "..", "jwks.json")),
          appKey,
          environment,
          false,
        ],
      ];
      async function runCase([name, mutate, key, env, expected]) {
        const directory = join(root, name);
        await cp(warm, directory, { recursive: true });
        await mutate(join(directory, namespace, "definitions.json"));
        const candidate = await launch(directory, sourceUrl, key, env);
        try {
          await dashboard(browser, candidate.origin, expected);
        } finally {
          await stop(candidate.child);
        }
        console.log(`local-signed-persistence: ${name}`);
      }
      // Separate directories/processes allow bounded parallel negative cases.
      for (let index = 0; index < cases.length; index += 3) {
        const results = await Promise.allSettled(
          cases.slice(index, index + 3).map(runCase),
        );
        for (const result of results)
          if (result.status === "rejected") throw result.reason;
      }
    } finally {
      await stop(host?.child);
      await browser.close();
      if (source.listening)
        await new Promise((resolve) => {
          source.close(resolve);
          source.closeAllConnections();
        });
      await rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "unsafe persistence configuration fails before serving requests",
  { timeout: 60000 },
  async () => {
    for (const options of [
      { TOGGLY_NETWORK_MODE: "typo" },
      { TOGGLY_NETWORK_MODE: "offline" },
      { TOGGLY_SNAPSHOT_DIRECTORY: published },
      { TOGGLY_SNAPSHOT_DIRECTORY: join(published, "wwwroot", "cache") },
      { TOGGLY_SNAPSHOT_DIRECTORY: "../relative-cache" },
      { TOGGLY_DEFINITIONS_URL: "http://remote.invalid/" },
      { TOGGLY_DEFINITIONS_URL: "https://remote.invalid/?secret=fixture" },
      { TOGGLY_DEFINITIONS_URL: "https://fixture@remote.invalid/" },
    ]) {
      const child = spawn(dotnet, ["BlazorSample.dll"], {
        cwd: published,
        stdio: "ignore",
        env: {
          PATH: process.env.PATH,
          DOTNET_ROOT: process.env.DOTNET_ROOT,
          TOGGLY_APP_KEY: appKey,
          TOGGLY_FRONTEND_APP_KEY: "",
          ...options,
        },
      });
      try {
        await Promise.race([once(child, "exit"), sleep(5000)]);
        assert.ok(
          child.exitCode !== null || child.signalCode !== null,
          "invalid configuration must fail at startup",
        );
        assert.notEqual(child.exitCode, 0);
      } finally {
        await stop(child);
      }
    }
  },
);
