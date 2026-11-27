"use strict";
/**
 * Published @ops-ai/toggly-docusaurus-plugin@0.10.4 treats a connected
 * WebSocket as a 20 minute cache. Live E2E sets a 1s refresh, but getFlags()
 * then keeps the first payload — filter-always-on stays OFF after the edge
 * has already moved. Honor the configured interval instead.
 *
 * Remove when a plugin release stops stretching isCacheValid on WebSocket.
 */
const fs = require("node:fs");
const path = require("node:path");

const STALE_CACHE =
  "const interval = _wsConnected ? FALLBACK_REFRESH_INTERVAL : featureFlagsRefreshInterval;";
const LIVE_CACHE = "const interval = featureFlagsRefreshInterval;";

function patchLiveFlagRefreshSource(source) {
  if (!source.includes(STALE_CACHE)) {
    if (source.includes(LIVE_CACHE)) {
      return { source, changed: false };
    }
    throw new Error(
      "toggly-client.js has no WebSocket cache interval to patch",
    );
  }
  return {
    source: source.replaceAll(STALE_CACHE, LIVE_CACHE),
    changed: true,
  };
}

function candidateFiles(root) {
  return [
    path.join(
      root,
      "node_modules/@ops-ai/toggly-docusaurus-plugin/dist/lib/toggly-client.js",
    ),
  ];
}

function patchInstalledLiveFlagRefresh(root) {
  const patched = [];
  for (const file of candidateFiles(root)) {
    if (!fs.existsSync(file)) continue;
    const current = fs.readFileSync(file, "utf8");
    const result = patchLiveFlagRefreshSource(current);
    if (result.changed) {
      fs.writeFileSync(file, result.source);
    }
    patched.push(file);
  }
  return patched;
}

module.exports = {
  patchLiveFlagRefreshSource,
  patchInstalledLiveFlagRefresh,
  STALE_CACHE,
  LIVE_CACHE,
};

if (require.main === module) {
  const root = path.resolve(__dirname, "../..");
  const patched = patchInstalledLiveFlagRefresh(root);
  if (patched.length === 0) {
    console.error(
      "patch-live-flag-refresh: @ops-ai/toggly-docusaurus-plugin client is not installed",
    );
    process.exit(1);
  }
}
