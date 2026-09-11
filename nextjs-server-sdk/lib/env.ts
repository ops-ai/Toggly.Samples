// An App Key selects definitions for an application; the environment selects
// that application's rule set. Neither setting creates flags in the dashboard.
// Keep server/edge reads here separate from the browser provider's public config.
export function getTogglyAppKey(): string | undefined {
  const key = process.env.TOGGLY_APP_KEY?.trim()
  return key || undefined
}

export function getTogglyEnvironment(): string {
  return process.env.TOGGLY_ENVIRONMENT?.trim() || 'Production'
}

export function hasTogglyAppKey(): boolean {
  return Boolean(getTogglyAppKey())
}
