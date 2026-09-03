import Link from 'next/link'

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
