export type FilterSurface = 'server' | 'client'

export type FilterCatalogEntry = {
  key: string
  title: string
  filter: string
  blurb: string
  surfaces: FilterSurface[]
}

/** Dedicated filter-* flags for the showcase matrix (existing demos untouched). */
export const FILTER_CATALOG: FilterCatalogEntry[] = [
  {
    key: 'filter-always-on',
    title: 'Always On',
    filter: 'AlwaysOn',
    blurb: 'Baseline control — always enabled.',
    surfaces: ['server', 'client'],
  },
  {
    key: 'filter-percentage',
    title: 'Percentage',
    filter: 'Percentage 50%',
    blurb: 'Sticky 50% rollout by identity.',
    surfaces: ['server'],
  },
  {
    key: 'filter-targeting',
    title: 'Targeting',
    filter: 'Targeting users=alice',
    blurb: 'ON only when identity is alice.',
    surfaces: ['server'],
  },
  {
    key: 'filter-user-claims',
    title: 'User Claims',
    filter: 'UserClaims role=admin',
    blurb: 'ON when claims.role is admin.',
    surfaces: ['server'],
  },
  {
    key: 'filter-time-window',
    title: 'Time Window',
    filter: 'TimeWindow open',
    blurb: 'Open window 2020→2099 — should be ON.',
    surfaces: ['server'],
  },
  {
    key: 'filter-country',
    title: 'Country',
    filter: 'Country US',
    blurb: 'ON when cf-ipcountry / country is US.',
    surfaces: ['server'],
  },
  {
    key: 'filter-browser-family',
    title: 'Browser Family',
    filter: 'BrowserFamily Chrome',
    blurb: 'ON for Chrome User-Agent.',
    surfaces: ['server', 'client'],
  },
  {
    key: 'filter-browser-language',
    title: 'Browser Language',
    filter: 'BrowserLanguage en',
    blurb: 'ON when Accept-Language includes en.',
    surfaces: ['server', 'client'],
  },
  {
    key: 'filter-device-type',
    title: 'Device Type',
    filter: 'DeviceType Macintosh',
    blurb: 'ON when UA device model is Macintosh (desktop Mac).',
    surfaces: ['server', 'client'],
  },
  {
    key: 'filter-os',
    title: 'Operating System',
    filter: 'OperatingSystem Mac',
    blurb: 'ON for Mac User-Agent.',
    surfaces: ['server', 'client'],
  },
  {
    key: 'filter-context-property',
    title: 'Context Property',
    filter: 'ContextProperty Order.Vip=true',
    blurb: 'ON when evaluating with a Vip Order entity.',
    surfaces: ['server'],
  },
]

export const CLIENT_FILTER_KEYS = FILTER_CATALOG.filter((e) =>
  e.surfaces.includes('client'),
).map((e) => e.key)

export const SERVER_FILTER_CATALOG = FILTER_CATALOG.filter((e) =>
  e.surfaces.includes('server'),
)
