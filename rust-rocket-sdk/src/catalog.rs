//! Shared workshop keys. Keep the flag recipe aligned with FLAG_TEMPLATE.md.
pub const FLAGS: [&str; 16] = [
    "new-dashboard",
    "api-v2",
    "enhanced-submit",
    "ExpressCheckout",
    "beta-access",
    "filter-always-on",
    "filter-percentage",
    "filter-targeting",
    "filter-user-claims",
    "filter-time-window",
    "filter-country",
    "filter-browser-family",
    "filter-browser-language",
    "filter-device-type",
    "filter-os",
    "filter-context-property",
];

pub const FILTERS: [(&str, &str, &str); 11] = [
    ("filter-always-on", "AlwaysOn", "On for both presets."),
    (
        "filter-percentage",
        "Percentage 50%",
        "Sticky by identity; neither preset prescribes an outcome.",
    ),
    (
        "filter-targeting",
        "Targeting users=alice",
        "Matching on; Non-matching off.",
    ),
    (
        "filter-user-claims",
        "UserClaims role=admin",
        "Matching on; Non-matching off.",
    ),
    (
        "filter-time-window",
        "TimeWindow 2020–2099",
        "On for both presets while the window is open.",
    ),
    (
        "filter-country",
        "Country US",
        "Matching on; Non-matching off.",
    ),
    (
        "filter-browser-family",
        "BrowserFamily Chrome",
        "Matching on; Non-matching off.",
    ),
    (
        "filter-browser-language",
        "BrowserLanguage en",
        "Matching on; Non-matching off.",
    ),
    (
        "filter-device-type",
        "DeviceType Macintosh",
        "Unsupported desktop detection in published 0.4.0: native false even for Matching. Recipe is unchanged.",
    ),
    (
        "filter-os",
        "OperatingSystem Mac",
        "Matching on; Non-matching off.",
    ),
    (
        "filter-context-property",
        "ContextProperty Order.Vip=true",
        "Matching on; Non-matching off.",
    ),
];
