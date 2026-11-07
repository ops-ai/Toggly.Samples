"use strict";
const { toBooleanDefinitions } = require("@ops-ai/toggly-hooks-types");

module.exports = toBooleanDefinitions({
  "filter-always-on": { enabled: true },
  "filter-targeting": true,
  plainOff: false,
});
