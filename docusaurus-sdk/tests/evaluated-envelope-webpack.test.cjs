/**
 * Ensures the docusaurus webpack alias applies the shim without circular require.
 * Node unit tests load the patch directly; this bundles through webpack like production.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const webpack = require("webpack");

const root = path.resolve(__dirname, "..");
const togglyHooksTypesShim = path.resolve(
  root,
  "src/sample/toggly-hooks-types-browser-shim.cjs",
);
const entityGateStock = path.resolve(
  root,
  "node_modules/@ops-ai/toggly-hooks-types/dist/entity-gate.js",
);
const togglyHooksTypesStock = path.resolve(
  root,
  "node_modules/@ops-ai/toggly-hooks-types/dist/index.js",
);
const entry = path.resolve(__dirname, "webpack-entity-gate-entry.cjs");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "toggly-entity-gate-webpack-"));

test("webpack-aliased entity gate normalizes mixed evaluated-signed payloads", (t, done) => {
  webpack(
    {
      mode: "production",
      context: root,
      entry,
      output: {
        path: outDir,
        filename: "bundle.cjs",
        library: { type: "commonjs2" },
      },
      resolve: {
        alias: {
          "@ops-ai/toggly-hooks-types": togglyHooksTypesShim,
          "toggly-entity-gate-stock": entityGateStock,
          "toggly-hooks-types-stock": togglyHooksTypesStock,
        },
      },
    },
    (err, stats) => {
      try {
        assert.ifError(err);
        assert.ifError(stats?.hasErrors() ? new Error(stats.toString()) : null);
        const bundlePath = path.join(outDir, "bundle.cjs");
        delete require.cache[bundlePath];
        const result = require(bundlePath);
        assert.deepEqual(result, {
          "filter-always-on": true,
          "filter-targeting": true,
          plainOff: false,
        });
        done();
      } catch (error) {
        done(error);
      }
    },
  );
});
