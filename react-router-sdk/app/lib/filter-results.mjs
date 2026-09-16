/** Present flags evaluate to true/false. A missing definition is not a failed rule. */
export function filterResultLabel(present, enabled) {
  return present ? String(enabled) : 'missing'
}

export function hasFlagDefinition(flags, key) {
  return Object.hasOwn(flags, key)
}
