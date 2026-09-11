'use server'

import {
  checkFeature,
  checkFeatureGate,
  withFeature,
} from '@ops-ai/nextjs-toggly-server'
import { initSampleToggly } from '@/lib/toggly'
import { getRequestIdentity } from '@/lib/identity'

export type ActionResult = {
  path: 'enhanced' | 'legacy' | 'gate'
  note: string
  message: string
  allowed?: boolean
}

// Check at execution time: the flag may change between displaying and submitting
// the form. These actions return demonstration data, not persisted mutations or
// authorization decisions. Both enhanced and legacy behavior remain explicit.
export async function submitWithCheck(formData: FormData): Promise<ActionResult> {
  await initSampleToggly()
  const identity = await getRequestIdentity()
  const note = String(formData.get('note') ?? '')
  const enabled = await checkFeature('enhanced-submit', identity)
  if (enabled) {
    return {
      path: 'enhanced',
      note,
      message: 'checkFeature: enhanced path',
    }
  }
  return {
    path: 'legacy',
    note,
    message: 'checkFeature: legacy path',
  }
}

export async function submitWithGate(formData: FormData): Promise<ActionResult> {
  await initSampleToggly()
  // Wrap per invocation so identity comes from the current request cookie.
  const identity = await getRequestIdentity()
  // withFeature runs only one callback. onDisabled is our chosen legacy response;
  // omitting it would use the SDK's disabled-action behavior instead.
  const gatedSubmit = withFeature(
    'enhanced-submit',
    async (data: FormData): Promise<ActionResult> => {
      const note = String(data.get('note') ?? '')
      return {
        path: 'enhanced',
        note,
        message: 'withFeature: ran primary action',
      }
    },
    {
      identity,
      onDisabled: async (): Promise<ActionResult> => ({
        path: 'legacy',
        note: '',
        message: 'withFeature: onDisabled fallback',
      }),
    },
  )
  return gatedSubmit(formData)
}

export async function submitWithFeatureGate(
  formData: FormData,
): Promise<ActionResult> {
  await initSampleToggly()
  const identity = await getRequestIdentity()
  const note = String(formData.get('note') ?? '')
  // A multi-key gate returns { allowed, ... }, not a boolean. Requiring all means
  // enhanced-submit alone is insufficient while api-v2 remains disabled.
  const result = await checkFeatureGate({
    featureKeys: ['enhanced-submit', 'api-v2'],
    requirement: 'all',
    identity,
  })

  return {
    path: 'gate',
    note,
    allowed: result.allowed,
    message: result.allowed
      ? 'checkFeatureGate: both enhanced-submit and api-v2 allowed'
      : `checkFeatureGate: denied${result.error ? ` (${result.error})` : ''}`,
  }
}
