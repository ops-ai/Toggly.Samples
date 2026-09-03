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
