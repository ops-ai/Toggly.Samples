import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configuration, isPushApplied } from "./live-policy.mjs";

const log = (event, data) => console.log(JSON.stringify({ event, data }));
let config;
try {
  config = configuration();
} catch {
  log("configuration-required");
  process.exitCode = 2;
}

if (config) {
  let context;
  let profile;
  // The actual SDK polls after five minutes. This complete run has a shorter
  // deadline, and no refresh control or context change occurs during toggle legs.
  const deadline = Date.now() + 180_000;
  const remaining = () => Math.max(1, deadline - Date.now());
  const bounded = (promise, maximum = 15_000) => {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("bounded-timeout")),
          Math.min(maximum, remaining()),
        );
      }),
    ]).finally(() => clearTimeout(timer));
  };
  try {
    const { chromium } = await import("playwright");
    const settingsResponse = await fetch(
      `${config.origin}/public-toggly.json`,
      { signal: AbortSignal.timeout(5000) },
    );
    assert.equal(settingsResponse.status, 200);
    const settings = await settingsResponse.json();
    assert.ok(
      settings.frontendAppKey === config.key &&
        settings.environment === config.environment,
      "host-public-settings-mismatch",
    );
    profile = await mkdtemp(join(tmpdir(), "toggly-blazor-live-"));
    let sequence = 0;
    let frame = 0;
    let latest;
    let observationFailed = false;
    let blockedHttp = 0;
    let blockedSockets = 0;
    const requests = new WeakMap();

    const start = async (offline) => {
      context = await chromium.launchPersistentContext(profile, {
        headless: true,
        serviceWorkers: "block",
        timeout: Math.min(15_000, remaining()),
        ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
          : {}),
      });
      context.setDefaultTimeout(Math.min(15_000, remaining()));
      if (offline) {
        // Only the locally hosted application shell/settings remain reachable.
        // No fulfilled routes or generated signed responses exist in this runner.
        await context.route("**/*", (route) => {
          if (new URL(route.request().url()).origin === config.origin)
            return route.continue();
          blockedHttp++;
          return route.abort("internetdisconnected");
        });
        await context.routeWebSocket(/.*/, (socket) => {
          const url = new URL(socket.url());
          if (
            url.hostname === new URL(config.origin).hostname &&
            url.port === new URL(config.origin).port
          ) {
            socket.connectToServer();
          } else {
            blockedSockets++;
            socket.close();
          }
        });
      }
      const page = context.pages()[0] ?? (await context.newPage());
      if (!offline) {
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (
            url.origin === "https://definitions.toggly.io" &&
            url.pathname.startsWith("/evaluated-signed/")
          )
            requests.set(request, ++sequence);
        });
        page.on("response", (response) => {
          const requestSequence = requests.get(response.request());
          if (!requestSequence || response.status() !== 200) return;
          // Catch every observer task; a failed parse cannot become an unhandled
          // rejection or silently count as accepted evidence.
          void (async () => {
            const body = await response.text();
            const envelope = JSON.parse(body);
            const headers = await response.allHeaders();
            const responseSequence = ++sequence;
            latest = {
              requestSequence,
              responseSequence,
              hash: createHash("sha256").update(body).digest("hex"),
              revision: headers["x-definitions-revision"] ?? headers.etag,
              kid: envelope.kid,
              timestamp: envelope.timestamp,
              value: envelope.defs["new-dashboard"],
            };
          })().catch(() => {
            observationFailed = true;
          });
        });
        page.on("websocket", (socket) => {
          if (new URL(socket.url()).origin !== "wss://definitions.toggly.io")
            return;
          socket.on("framereceived", ({ payload }) => {
            const text =
              typeof payload === "string" ? payload : payload.toString();
            let type = text;
            try {
              type = JSON.parse(text).type;
            } catch {
              /* Legacy invalidation text is valid. */
            }
            if (["update", "flags-updated"].includes(type)) frame = ++sequence;
          });
        });
      }
      await page.goto(`${config.origin}/wasm/identity`, {
        timeout: Math.min(20_000, remaining()),
      });
      await page
        .locator("header")
        .filter({ hasText: "browser runtime" })
        .waitFor();
      await page
        .getByRole("button", { name: "Matching", exact: true })
        .waitFor();
      return page;
    };

    const preset = async (page, name, expected) => {
      await page.getByRole("link", { name: "Identity", exact: true }).click();
      await page.getByRole("button", { name, exact: true }).click();
      await page
        .getByTestId("targeting")
        .filter({ hasText: expected ? "ON" : "OFF" })
        .waitFor();
    };
    const dashboard = async (page, expected) => {
      await page.getByRole("link", { name: "Home", exact: true }).click();
      await page
        .getByTestId("dashboard")
        .filter({
          hasText: expected ? "New dashboard enabled" : "Classic dashboard",
        })
        .waitFor();
    };
    const persisted = async (page, hash) =>
      page.evaluate(async (expectedHash) => {
        for (const key of Object.keys(localStorage).filter((key) =>
          key.startsWith("toggly:"),
        )) {
          const saved = JSON.parse(localStorage.getItem(key));
          if (saved.formatVersion !== 2 || !saved.trustedJwks) continue;
          const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(saved.envelope),
          );
          const actual = Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("");
          if (actual === expectedHash) return true;
        }
        return false;
      }, hash);
    const wait = async (predicate, maximum = 45_000) => {
      const end = Math.min(deadline, Date.now() + maximum);
      while (Date.now() < end) {
        assert.ok(!observationFailed, "network-observer-failed");
        if (await predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("acceptance-timeout");
    };

    let page = await start(false);
    await preset(page, "Non-matching", false);
    await preset(page, "Matching", true);
    await dashboard(page, false);
    await wait(
      async () =>
        latest?.value === false && (await persisted(page, latest.hash)),
    );
    log("baseline-accepted", latest);
    for (const expected of [true, false]) {
      const previous = latest;
      const marker = sequence;
      log(
        expected ? "set-new-dashboard-true-now" : "set-new-dashboard-false-now",
      );
      await wait(
        async () =>
          isPushApplied(marker, frame, previous, latest, expected) &&
          (await persisted(page, latest.hash)),
      );
      // Stay on the same mounted page; no navigation or refresh initiates this update.
      await page
        .getByTestId("dashboard")
        .filter({
          hasText: expected ? "New dashboard enabled" : "Classic dashboard",
        })
        .waitFor();
      log("push-applied", latest);
    }
    const acceptedHash = latest.hash;
    await bounded(context.close());
    context = null;
    page = await start(true);
    await preset(page, "Matching", true);
    await dashboard(page, false);
    assert.ok(
      await persisted(page, acceptedHash),
      "live-snapshot-not-preserved",
    );
    await preset(page, "Non-matching", false);
    await preset(page, "Matching", true);
    await dashboard(page, false);
    await wait(() => blockedHttp > 0 && blockedSockets > 0, 10_000);
    log("cold-browser-accepted", {
      hash: acceptedHash,
      blockedHttp,
      blockedSockets,
    });
    log("blazor-live-acceptance-passed");
  } catch (error) {
    // Playwright errors may include configured URLs; never print raw messages/stacks.
    log("acceptance-failed", { errorType: error.constructor.name });
    process.exitCode = 1;
  } finally {
    try {
      await bounded(context?.close(), 10_000);
      if (profile) await rm(profile, { recursive: true, force: true });
    } catch {
      log("cleanup-failed");
      process.exitCode = 1;
      // A wedged browser transport must not hold the acceptance process indefinitely.
      process.exit(1);
    }
  }
}
