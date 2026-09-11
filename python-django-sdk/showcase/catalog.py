"""The shared recipe as data, not a sample implementation of filter evaluation."""
BASE_KEYS = ['new-dashboard', 'api-v2', 'enhanced-submit', 'ExpressCheckout', 'beta-access']
ORDER_RULE = {'ContextKind': 'Order', 'Property': 'Vip', 'Operator': 'eq', 'Value': 'true', 'ValueType': 'boolean'}
FILTERS = [
    ('filter-always-on', 'AlwaysOn', {}, 'ON for both presets.'),
    ('filter-percentage', 'Percentage', {'Value': 50}, 'Sticky by identity; no prescribed Alice/Bob result.'),
    ('filter-targeting', 'Targeting', {'Audience.Users:0': 'alice'}, 'Alice only.'),
    ('filter-user-claims', 'UserClaims', {'Claim': 'role', 'Value': 'admin', 'Percentage': 100}, 'Explicit role claim; native Django extraction omits claims.'),
    ('filter-time-window', 'TimeWindow', {'Start': '2020-01-01T00:00:00Z', 'End': '2099-12-31T23:59:59Z'}, 'ON while the window is open, for both presets.'),
    ('filter-country', 'Country', {'Country:0': 'US', 'Percentage': 100}, 'Explicit request country US.'),
    ('filter-browser-family', 'BrowserFamily', {'BrowserFamily:0': 'Chrome', 'Percentage': 100}, 'Explicit Chrome User-Agent.'),
    ('filter-browser-language', 'BrowserLanguage', {'BrowserLanguage:0': 'en', 'Percentage': 100}, 'Explicit Accept-Language includes en.'),
    ('filter-device-type', 'DeviceType', {'DeviceType:0': 'Macintosh', 'Percentage': 100}, 'Published Python classifier reports Other for Macintosh: OFF for both. Rule unchanged.'),
    ('filter-os', 'OperatingSystem', {'OperatingSystem:0': 'Mac', 'Percentage': 100}, 'Mac matches the native Mac OS family.'),
    ('filter-context-property', 'ContextProperty', ORDER_RULE, 'Order.Vip equals true.'),
]
ALL_KEYS = BASE_KEYS + [row[0] for row in FILTERS]
