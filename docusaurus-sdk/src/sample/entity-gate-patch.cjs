"use strict";
/**
 * Temporary shim until @ops-ai/toggly-hooks-types resolves evaluated-signed
 * `{ enabled: boolean }` envelopes (see tests/evaluated-envelope.test.cjs).
 * Webpack aliases this module over dist/entity-gate.js for browser bundles.
 */
const original = require("@ops-ai/toggly-hooks-types/dist/entity-gate.js");

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
