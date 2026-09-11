// Angular does not automatically expose arbitrary env variables. Copy only the
// two public values we intend to ship; never spread process.env into the app.
const fs = require("node:fs");
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
const config = {
  appKey: process.argv.includes("--offline")
    ? ""
    : process.env.TOGGLY_APP_KEY || "",
  environment: process.env.TOGGLY_ENVIRONMENT || "Production",
};
fs.writeFileSync(
  "src/generated-config.ts",
  "// Generated public browser configuration. Do not edit.\nexport const publicConfig = " +
    JSON.stringify(config) +
    ";\n",
);
