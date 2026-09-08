export type Requirement = 'all' | 'any'
export type FlagReader = {
  isFeatureOn(key: string, context?: Record<string, unknown>, kind?: string): boolean
  evaluateFeatureGate(keys: string[], requirement: Requirement, negate?: boolean): boolean
  getVariant(key: string): { name: string; configurationValue?: unknown } | null
}

export const matchingPreset = {
  identity: 'alice', claims: { role: 'admin' }, country: 'US',
  acceptLanguage: 'en-US,en;q=0.9',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  orderId: 'ord-vip', vip: true,
}
export const nonMatchingPreset = {
  identity: 'bob', claims: { role: 'user' }, country: 'CA',
  acceptLanguage: 'fr-FR,fr;q=0.9',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  orderId: 'ord-standard', vip: false,
}

export function createTogglyConfig(appKey: string, flagDefaults: Record<string, boolean>, environment = 'Production') {
  return appKey && appKey !== 'ci-placeholder'
    ? { appKey, environment, enableVariants: true }
    : { flagDefaults, enableLiveUpdates: false, persistCache: false }
}

export function createSnapshot(reader: FlagReader) {
  return {
    newDashboard: reader.isFeatureOn('new-dashboard'),
    dashboardNegated: reader.evaluateFeatureGate(['new-dashboard'], 'all', true),
    allGate: reader.evaluateFeatureGate(['new-dashboard', 'api-v2'], 'all'),
    anyGate: reader.evaluateFeatureGate(['new-dashboard', 'api-v2'], 'any'),
    variant: reader.getVariant('new-dashboard')?.name ?? 'none',
  }
}
