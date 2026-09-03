import Link from 'next/link'
import { FlagSnapshot } from '@/components/flag-snapshot'
import { IdentitySwitcher } from '@/components/identity-switcher'
import { getRequestIdentity } from '@/lib/identity'

export default async function HomePage() {
  const identity = await getRequestIdentity()

  return (
    <>
      <h1>Next.js SDK Showcase</h1>
      <p>
        Single app with clear <strong>Server</strong>, <strong>Client</strong>,
        and <strong>Edge</strong> sections for{' '}
        <code>@ops-ai/nextjs-toggly-*</code>. Flip flags in the Toggly dashboard
        for app &quot;Next.js Server SDK Sample&quot;, then reload (server/edge)
        or watch live updates (client).
      </p>

      <div className="card">
        <h2>Sections</h2>
        <ul>
          <li>
            <Link href="/server">Server</Link> — RSC, actions, cache, entity,
            per-call identity
          </li>
          <li>
            <Link href="/client">Client</Link> — TogglyProvider, hooks,
            components
          </li>
          <li>
            <Link href="/edge">Edge</Link> — middleware path gates (
            <code>beta-access</code>)
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Flag checklist</h2>
        <ul>
          <li>
            <code>new-dashboard</code> →{' '}
            <Link href="/server/dashboard">/server/dashboard</Link>,{' '}
            <Link href="/server/components">/server/components</Link>, client
            demos
          </li>
          <li>
            <code>enhanced-submit</code> →{' '}
            <Link href="/server/actions">/server/actions</Link>
          </li>
          <li>
            <code>api-v2</code> →{' '}
            <Link href="/server/api-demo">/server/api-demo</Link>
          </li>
          <li>
            <code>ExpressCheckout</code> (Order Vip==true) →{' '}
            <Link href="/server/orders">/server/orders</Link>
          </li>
          <li>
            <code>beta-access</code> →{' '}
            <Link href="/edge/beta">/edge/beta</Link> (middleware)
          </li>
        </ul>
      </div>

      <IdentitySwitcher current={identity} />
      <FlagSnapshot />
    </>
  )
}
