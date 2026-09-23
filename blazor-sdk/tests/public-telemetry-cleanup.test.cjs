const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");

const connect = (port) => new Promise((resolve) => {
  const socket = net.connect({ host: "127.0.0.1", port });
  socket.once("connect", () => { socket.destroy(); resolve(true); });
  socket.once("error", () => resolve(false));
});

test("rejected browser close still frees both loopback ports and Chromium", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "toggly-wasm-close-"));
  try {
    const probeFile = path.join(directory, "probe.jsonl");
    const result = spawnSync(process.execPath, [
      "--require", path.join(__dirname, "public-telemetry-close-rejection.cjs"),
      path.join(__dirname, "public-telemetry-browser.cjs"),
    ], {
      env: { ...process.env, TOGGLY_CLOSE_PROBE_FILE: probeFile },
      encoding: "utf8",
      timeout: 30000,
    });
    assert.equal(result.error, undefined, result.stderr);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /injected-page-failure/);
    assert.match(result.stderr, /injected-browser-close-rejection/);
    const observations = fs.readFileSync(probeFile, "utf8").trim().split("\n").map(JSON.parse);
    const ports = observations.filter(({ port }) => port).map(({ port }) => port);
    // Playwright's WebSocket owner may add a third local listening port.
    assert.ok(ports.length >= 2);
    for (const port of ports) assert.equal(await connect(port), false, `port ${port} remains open`);
    const pid = observations.find(({ pid }) => pid)?.pid;
    assert.ok(pid);
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
