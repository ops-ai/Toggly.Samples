import Link from 'next/link'

// Keep a disabled destination reachable independently of its gate. Visiting this
// page directly says nothing about the current flag value; retry the gated URL.
export default function EdgeWaitlistPage() {
  return (
    <>
      <h1>Waitlist</h1>
      <p>
        Redirect target when <code>beta-access</code> is OFF for{' '}
        <code>/edge/beta</code>. This path is not gated by middleware.
      </p>
      <p>
        <Link href="/edge/beta">Try /edge/beta again</Link> ·{' '}
        <Link href="/edge">Edge index</Link>
      </p>
    </>
  )
}
