"use strict";
/**
 * Client-bundle re-export of @ops-ai/toggly-hooks-types with evaluated { enabled }
 * handling from entity-gate-patch.cjs. Webpack aliases the package name to this
 * file for browser builds only (see docusaurus.config.js).
 *
 * Remove when https://linear.app/opsai/issue/OPS-2052 ships.
 */
const stock = require("toggly-hooks-types-stock");
const patch = require("./entity-gate-patch.cjs");

module.exports = {
  ...stock,
  resolveEvaluatedDefinition: patch.resolveEvaluatedDefinition,
  toBooleanDefinitions: patch.toBooleanDefinitions,
};
