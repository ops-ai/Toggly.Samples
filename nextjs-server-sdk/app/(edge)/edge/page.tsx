import Link from 'next/link'

export default function EdgeIndexPage() {
  return (
    <>
      <h1>Edge showcase</h1>
      <p>
        <code>middleware.ts</code> uses{' '}
        <code>createPathFeatureMiddleware</code> from{' '}
        <code>@ops-ai/nextjs-toggly-edge</code> to gate{' '}
        <code>/edge/beta</code> with flag <code>beta-access</code>.
      </p>
      <ul>
        <li>
          When <code>beta-access</code> is <strong>ON</strong>,{' '}
          <Link href="/edge/beta">/edge/beta</Link> renders the beta page.
        </li>
        <li>
          When <strong>OFF</strong>, middleware redirects to{' '}
          <Link href="/edge/waitlist">/edge/waitlist</Link>.
        </li>
        <li>
          <Link href="/edge/waitlist">/edge/waitlist</Link> and{' '}
          <Link href="/edge/unavailable">/edge/unavailable</Link> stay
          reachable (not matched by middleware).
        </li>
      </ul>
      <p className="muted">
        Create boolean flag <code>beta-access</code> in the Toggly dashboard if
        it does not exist yet.
      </p>
    </>
  )
}
