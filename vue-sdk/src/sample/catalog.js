// Flag keys are stable API contracts. Reuse them in Toggly and in the UI;
// renaming a label here does not rename a dashboard flag.
export const demoKeys = [
  "new-dashboard",
  "api-v2",
  "enhanced-submit",
  "ExpressCheckout",
  "beta-access",
];
export const filters = [
  ["filter-always-on", "AlwaysOn", "Always on in both presets"],
  [
    "filter-percentage",
    "Percentage",
    "50%; sticky by identity, not a guaranteed match",
  ],
  ["filter-targeting", "Targeting", "User alice"],
  ["filter-user-claims", "UserClaims", "role = admin"],
  ["filter-time-window", "TimeWindow", "Open from 2020 through 2099"],
  ["filter-country", "Country", "US"],
  ["filter-browser-family", "BrowserFamily", "Chrome"],
  ["filter-browser-language", "BrowserLanguage", "en"],
  ["filter-device-type", "DeviceType", "Macintosh"],
  ["filter-os", "OperatingSystem", "Mac"],
  ["filter-context-property", "ContextProperty", "Order.Vip = true"],
].map(([key, name, rule]) => ({ key, name, rule }));
export const allKeys = [...demoKeys, ...filters.map((f) => f.key)];
export const users = {
  matching: {
    identity: "alice",
    groups: ["beta"],
    claims: { role: "admin" },
    country: "US",
    language: "en-US,en;q=0.9",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  nonmatching: {
    identity: "bob",
    groups: [],
    claims: { role: "user" },
    country: "CA",
    language: "fr-FR,fr;q=0.9",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  },
};
export const orders = {
  vip: { Id: "ord-vip", Vip: true, Total: 240 },
  standard: { Id: "ord-standard", Vip: false, Total: 60 },
};
// EntityGate is a real SDK payload shape. The SDK evaluates it against each
// Order, so switching orders must not change the signed-in user's identity.
export const orderGate = {
  requirement: "all",
  rules: [{ property: "Vip", op: "eq", value: "true", type: "boolean" }],
};
export function targeting(user) {
  return {
    identity: user.identity,
    groups: [...user.groups],
    claims: { ...user.claims },
  };
}
