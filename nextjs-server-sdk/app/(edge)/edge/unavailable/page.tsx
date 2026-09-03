import Link from 'next/link'

export default function EdgeUnavailablePage() {
  return (
    <>
      <h1>Unavailable</h1>
      <p>
        Example rewrite / custom-disabled target page. Not gated by the sample
        middleware matcher — useful when documenting <code>rewriteTo</code> or{' '}
        <code>onDisabled</code> options from the edge docs.
      </p>
      <p>
        <Link href="/edge">Edge index</Link>
      </p>
    </>
  )
}
