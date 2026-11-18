"use strict";
/**
 * Published @ops-ai/toggly-hooks-types@1.4.6 treats evaluated-signed
 * `{ enabled: boolean }` envelopes as false. Docusaurus webpack does not
 * reliably apply the package alias, so Live E2E still renders filter-always-on
 * OFF while the edge evaluates ON. Patch the installed entity-gate.js before
 * start/build. Remove when OPS-2052 is published and this sample depends on it.
 */
const fs = require("node:fs");
const path = require("node:path");

const ENABLED_CHECK = `
    if (value && typeof value === "object" && !Array.isArray(value) &&
        Object.prototype.hasOwnProperty.call(value, "enabled") &&
        typeof value.enabled === "boolean" && !isEntityGate(value)) {
        return value.enabled;
    }`;

const INSERT_AFTER =
  /if \(value === false\) \{\r?\n[ \t]*return false;\r?\n[ \t]*\}/;

function patchEntityGateSource(source) {
  if (source.includes('typeof value.enabled === "boolean" && !isEntityGate(value)')) {
    return { source, changed: false };
  }
  const match = INSERT_AFTER.exec(source);
  if (!match) {
    throw new Error(
      "entity-gate.js has no resolveEvaluatedDefinition false branch to patch",
    );
  }
  const next =
    source.slice(0, match.index + match[0].length) +
    ENABLED_CHECK +
    source.slice(match.index + match[0].length);
  return { source: next, changed: true };
}

function candidateFiles(root) {
  return [
    path.join(
      root,
      "node_modules/@ops-ai/toggly-hooks-types/dist/entity-gate.js",
    ),
    path.join(
      root,
      "node_modules/@ops-ai/toggly-docusaurus-plugin/node_modules/@ops-ai/toggly-hooks-types/dist/entity-gate.js",
    ),
  ];
}

function patchInstalledHooksTypes(root) {
  const patched = [];
  for (const file of candidateFiles(root)) {
    if (!fs.existsSync(file)) continue;
    const current = fs.readFileSync(file, "utf8");
    const result = patchEntityGateSource(current);
    if (result.changed) {
      fs.writeFileSync(file, result.source);
    }
    patched.push(file);
  }
  return patched;
}

module.exports = {
  patchEntityGateSource,
  patchInstalledHooksTypes,
};

if (require.main === module) {
  const root = path.resolve(__dirname, "../..");
  const patched = patchInstalledHooksTypes(root);
  if (patched.length === 0) {
    console.error(
      "patch-evaluated-enabled-envelope: @ops-ai/toggly-hooks-types is not installed",
    );
    process.exit(1);
  }
}
