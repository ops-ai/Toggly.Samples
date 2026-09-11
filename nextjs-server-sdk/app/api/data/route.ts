import { NextResponse } from 'next/server'
import { getServerToggly } from '@ops-ai/nextjs-toggly-server'
import { initSampleToggly } from '@/lib/toggly'
import { hasTogglyAppKey } from '@/lib/env'
import { getRequestIdentity } from '@/lib/identity'

export async function GET() {
  if (!hasTogglyAppKey()) {
    return NextResponse.json(
      { error: 'TOGGLY_APP_KEY missing' },
      { status: 503 },
    )
  }

  // Route Handlers can be called without visiting a page. Initialize here and
  // evaluate on every request, using its cookie identity. Missing configuration
  // above is a 503; a configured but OFF flag below keeps the legacy API response.
  await initSampleToggly()
  const identity = await getRequestIdentity()
  const toggly = getServerToggly()
  const useV2 = toggly
    ? await toggly.isFeatureOn('api-v2', null, undefined, identity)
    : false

  if (useV2) {
    return NextResponse.json({ version: 2, data: 'new', flag: 'api-v2' })
  }
  return NextResponse.json({ version: 1, data: 'legacy', flag: 'api-v2' })
}
