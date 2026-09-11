import Link from 'next/link'

// The gate is in middleware, before this page. The visible ON label assumes a
// configured App Key; missing configuration bypasses middleware for exploration.
// Do not infer authorization from reaching this page (see README edge limitation).
export default function EdgeBetaPage() {
  return (
    <>
      <h1>Beta (gated)</h1>
      <p className="on">
        You reached <code>/edge/beta</code> — middleware allowed the request
        (the gate is bypassed when the App Key is missing).
      </p>
      <p>
        <Link href="/edge">Back to edge index</Link>
      </p>
    </>
  )
}
