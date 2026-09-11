import { getFeatures, getServerToggly } from '@ops-ai/nextjs-toggly-server'
import { Providers } from '@/components/providers'
import Link from 'next/link'

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // getFeatures uses process defaults, not the identity cookie or an Order.
  // Hydration supplies a starting snapshot; the browser subsequently fetches its
  // own results. Matching server/browser keys and environments avoids accidental
  // cross-environment defaults, but this is not per-user SSR authorization.
  // Prefer boolean snapshot for TogglyProvider hydration
  let initialFeatures: Record<string, boolean> = {}
  if (getServerToggly()) {
    try {
      initialFeatures = await getFeatures()
    } catch {
      initialFeatures = {}
    }
  }

  return (
    <Providers initialFeatures={initialFeatures}>
      <p className="muted">
        Client section wraps children in <code>TogglyProvider</code>. Optional{' '}
        <code>initialFeatures</code> hydrates from <code>getFeatures()</code>{' '}
        (SSR snapshot, not server gate evaluation).{' '}
        <Link href="/client">Client index</Link>
      </p>
      {children}
    </Providers>
  )
}
