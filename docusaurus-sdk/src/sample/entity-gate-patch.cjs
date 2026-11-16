"use strict";
/**
 * Browser bundle shim (webpack alias target). Loads stock implementation via
 * `toggly-entity-gate-stock`, which must alias to the real entity-gate.js and
 * must not alias back to this file (see docusaurus.config.js).
 *
 * Canonical fix: https://linear.app/opsai/issue/OPS-2052
 */
const original = require("toggly-entity-gate-stock");

function resolveEvaluatedDefinition(value, context, defaultValue = false) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.enabled === "boolean"
  ) {
    return value.enabled;
  }
  return original.resolveEvaluatedDefinition(value, context, defaultValue);
}

function toBooleanDefinitions(definitions, context) {
  const result = {};
  for (const key of Object.keys(definitions)) {
    result[key] = resolveEvaluatedDefinition(definitions[key], context);
  }
  return result;
}

module.exports = {
  ...original,
  resolveEvaluatedDefinition,
  toBooleanDefinitions,
};
