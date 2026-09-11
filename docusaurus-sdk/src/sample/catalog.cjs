// Shared flag names mirror docs/FLAG_TEMPLATE.md. HTTP results below are
// recorded teaching fixtures, not a second implementation of Toggly filters.
const demoKeys = [
  "new-dashboard",
  "api-v2",
  "enhanced-submit",
  "ExpressCheckout",
  "beta-access",
];
const filters = [
  ["filter-always-on", "AlwaysOn", "Always on"],
  ["filter-percentage", "Percentage", "50% sticky by identity"],
  ["filter-targeting", "Targeting", "User alice"],
  ["filter-user-claims", "UserClaims", "role = admin"],
  ["filter-time-window", "TimeWindow", "2020 through 2099"],
  ["filter-country", "Country", "US"],
  ["filter-browser-family", "BrowserFamily", "Chrome"],
  ["filter-browser-language", "BrowserLanguage", "en"],
  ["filter-device-type", "DeviceType", "Macintosh"],
  ["filter-os", "OperatingSystem", "Mac"],
  ["filter-context-property", "ContextProperty", "Order.Vip = true"],
];
const orders = {
  vip: { Id: "ord-vip", Vip: true, Total: 240 },
  standard: { Id: "ord-standard", Vip: false, Total: 60 },
};
const users = {
  matching: { identity: "alice", groups: ["beta"], claims: { role: "admin" } },
  nonmatching: { identity: "bob", groups: [], claims: { role: "user" } },
};
const httpPresets = {
  matching: {
    country: "US",
    language: "en-US,en;q=0.9",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  nonmatching: {
    country: "CA",
    language: "fr-FR,fr;q=0.9",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  },
};
const allKeys = [...demoKeys, ...filters.map(([key]) => key)];
const orderGate = {
  requirement: "all",
  rules: [{ property: "Vip", op: "eq", value: "true", type: "boolean" }],
};
function fixtureFlags(preset, toggles) {
  return {
    ...Object.fromEntries(
      filters.map(([key]) => [
        key,
        key === "filter-always-on" ||
          key === "filter-time-window" ||
          preset === "matching",
      ]),
    ),
    ...toggles,
  };
}
function registerOrder(client) {
  client.registerContext("Order", (order) => ({
    kind: "Order",
    key: order.Id,
    attributes: { Vip: order.Vip, Total: order.Total },
  }));
}
module.exports = {
  demoKeys,
  filters,
  orders,
  users,
  httpPresets,
  allKeys,
  orderGate,
  fixtureFlags,
  registerOrder,
};
