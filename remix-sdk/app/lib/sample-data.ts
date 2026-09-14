export type Order = { id: string; vip: boolean; total: number }

export const ORDERS: Order[] = [
  { id: 'ord-vip', vip: true, total: 275 },
  { id: 'ord-standard', vip: false, total: 85 },
]

export const FILTER_ROWS = [
  ['filter-always-on', 'AlwaysOn', 'ON for both presets'],
  ['filter-percentage', 'Percentage 50%', 'Sticky result for identity; not prescribed'],
  ['filter-targeting', 'Targeting users=alice', 'alice / bob'],
  ['filter-user-claims', 'UserClaims role=admin', 'admin / user'],
  ['filter-time-window', 'TimeWindow 2020–2099', 'ON while window is open'],
  ['filter-country', 'Country US', 'US / CA'],
  ['filter-browser-family', 'BrowserFamily Chrome', 'Chrome / Firefox'],
  ['filter-browser-language', 'BrowserLanguage en', 'en-US / fr-FR'],
  ['filter-device-type', 'DeviceType Macintosh', 'Macintosh / Windows'],
  ['filter-os', 'OperatingSystem Mac', 'Mac / Windows'],
  ['filter-context-property', 'Order.Vip=true', 'ord-vip / ord-standard'],
] as const

export const MATCHING_HEADERS = {
  'cf-ipcountry': 'US',
  'accept-language': 'en-US,en;q=0.9',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

export const NON_MATCHING_HEADERS = {
  'cf-ipcountry': 'CA',
  'accept-language': 'fr-FR,fr;q=0.9',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
}
