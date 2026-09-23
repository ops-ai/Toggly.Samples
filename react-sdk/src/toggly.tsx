import { useCallback, useContext, useEffect, useState } from 'react'
import {
  context,
  type TogglyEntityContext,
  type TogglyService,
} from '@ops-ai/react-feature-flags-toggly'

export function useTogglyService(): TogglyService | undefined {
  return useContext(context).toggly
}

/**
 * The declarative components are ideal for visibility. This hook deliberately
 * uses the service API so a learner can see how to drive a button, status, or
 * non-visual decision with the same evaluated definitions.
 */
export function useProgrammaticFlag(
  featureKey: string,
  entity?: TogglyEntityContext | Record<string, unknown> | null,
  contextKind?: string,
) {
  const toggly = useTogglyService()
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(Boolean(toggly))

  const evaluate = useCallback(async (showLoading = true) => {
    if (!toggly) {
      return false
    }

    // The first render starts in the loading state. Manual evaluations may
    // show that state again, while background refreshes keep the UI stable.
    if (showLoading) setLoading(true)
    const next = await toggly.isFeatureOn(featureKey, entity, contextKind)
    setEnabled(next)
    setLoading(false)
    return next
  }, [contextKind, entity, featureKey, toggly])

  useEffect(() => {
    if (!toggly) return undefined

    // The first evaluation talks directly to the SDK. Its state changes occur
    // after the promise resolves, so React does not perform a second render
    // synchronously while it is applying this external subscription.
    let current = true
    void toggly
      .isFeatureOn(featureKey, entity, contextKind)
      .then((next) => {
        if (!current) return
        setEnabled(next)
        setLoading(false)
      })
      .catch(() => {
        if (!current) return
        setEnabled(false)
        setLoading(false)
      })

    return () => {
      current = false
    }
  }, [contextKind, entity, featureKey, toggly])

  useEffect(() => {
    if (!toggly) return undefined
    // HTTP refresh and live-update reloads use the same source of truth.
    return toggly.subscribeFeaturesRefresh(() => void evaluate(false))
  }, [evaluate, toggly])

  return { enabled, loading, evaluate, toggly }
}

// Notify selections before the SDK changes context, including a failed refresh.
// The WeakMap follows each existing owner; it creates no SDK or reporter.
const contextChanges = new WeakMap<TogglyService, Set<() => void>>()
export function subscribeSampleContextChanges(service: TogglyService, listener: () => void) {
  let listeners = contextChanges.get(service)
  if (!listeners) { listeners = new Set(); contextChanges.set(service, listeners) }
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export async function setSampleContext(service: TogglyService, next: Parameters<TogglyService['setContext']>[0]) {
  contextChanges.get(service)?.forEach(listener => listener())
  await service.setContext(next)
}
