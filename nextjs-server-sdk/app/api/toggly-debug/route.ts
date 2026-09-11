import { NextResponse } from 'next/server'
import {
  getServerToggly,
  refreshServerToggly,
} from '@ops-ai/nextjs-toggly-server'
import { initSampleToggly } from '@/lib/toggly'

// A sample diagnostic surface: raw process state can explain fetch failures,
// but does not prove a particular user/Order check. refresh=1 requests definitions
// again; it does not invalidate the separate cached-helper page results.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  await initSampleToggly()
  const client = getServerToggly()
  const url = new URL(request.url)
  if (url.searchParams.get('refresh') === '1') {
    await refreshServerToggly()
  }

  return NextResponse.json({
    initialized: !!client,
    wsConnected: client?.state.wsConnected ?? false,
    lastRefresh: client?.state.lastRefresh ?? null,
    error: client?.state.error?.message ?? null,
    features: client?.state.features ?? {},
  })
}
