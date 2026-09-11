// Environment variables are read by Node at build/start time. The plugin
// serializes this public App Key into the browser; never put a private key here.
if (require("node:fs").existsSync(".env.local"))
  process.loadEnvFile(".env.local");
const defaults = {
  "new-dashboard": false,
  "api-v2": false,
  "enhanced-submit": false,
  ExpressCheckout: false,
  "beta-access": false,
};
module.exports = {
  title: "Toggly · Docusaurus workshop",
  tagline: "Flags from docs to a decision",
  url: "https://example.invalid",
  baseUrl: "/",
  onBrokenLinks: "throw",
  presets: [
    [
      "classic",
      {
        docs: { sidebarPath: false },
        blog: false,
        theme: { customCss: require.resolve("./src/style.css") },
      },
    ],
  ],
  plugins: [
    // Browser WebCrypto verifies signatures. Ignore only the unused Node crypto
    // branch in webpack's browser graph; never turn off signature verification.
    function browserCrypto() {
      return {
        name: "browser-crypto",
        configureWebpack(_config, isServer) {
          return isServer ? {} : { resolve: { fallback: { crypto: false } } };
        },
      };
    },
    [
      "@ops-ai/toggly-docusaurus-plugin",
      {
        appKey: process.env.TOGGLY_APP_KEY || undefined,
        environment: process.env.TOGGLY_ENVIRONMENT || "Production",
        identity: "alice",
        flagDefaults: defaults,
        verifySignatures: true,
        renderAllDuringBuild: true,
        staticGating: false,
        featureFlagsRefreshInterval: 1000,
      },
    ],
  ],
  themeConfig: {
    colorMode: { defaultMode: "light", disableSwitch: true },
    navbar: {
      title: "Toggly / Docusaurus workshop",
      items: [
        { to: "/", label: "Workshop", position: "left" },
        { to: "/docs/beta", label: "Beta guide", position: "left" },
      ],
    },
    footer: {
      style: "light",
      copyright:
        "Feature flags choose presentation. Servers enforce authorization.",
    },
  },
};
