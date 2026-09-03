import Link from 'next/link'

export default function EdgeBetaPage() {
  return (
    <>
      <h1>Beta (gated)</h1>
      <p className="on">
        You reached <code>/edge/beta</code> — <code>beta-access</code> is ON
        (middleware allowed the request).
      </p>
      <p>
        <Link href="/edge">Back to edge index</Link>
      </p>
    </>
  )
}
