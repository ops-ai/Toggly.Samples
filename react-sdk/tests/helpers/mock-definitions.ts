/** Match 1.14.1+ dual-rail fetches when enableVariants is on (variants + entity-evaluated booleans). */
export function mockEvaluatedDefinitionsBody(
  url: URL,
  enabledForAlice: boolean,
): { defs: Record<string, unknown> } {
  const variantsRail = url.pathname.includes('/evaluated-variants-signed/')
  const identity = variantsRail ? url.searchParams.get('userId') : url.searchParams.get('u')
  const enabled = identity === 'alice' && enabledForAlice
  if (variantsRail) {
    return {
      defs: {
        'new-dashboard': { enabled, variant: enabled ? 'enabled' : 'disabled' },
      },
    }
  }
  if (url.pathname.includes('/evaluated-signed/')) {
    return { defs: { 'new-dashboard': enabled } }
  }
  return { defs: { 'new-dashboard': false } }
}
