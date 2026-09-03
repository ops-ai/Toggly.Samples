import Link from 'next/link'

export default function ClientIndexPage() {
  return (
    <>
      <h1>Client showcase</h1>
      <p>
        Demos for <code>@ops-ai/nextjs-toggly-client</code>. Requires{' '}
        <code>NEXT_PUBLIC_TOGGLY_APP_KEY</code>. Live updates arrive over the
        client WebSocket without a full reload.
      </p>
      <ul>
        <li>
          <Link href="/client/hooks">Hooks</Link> — useFeatureFlag,
          useFeatureGate, useFeatures, useIdentity, useToggly
        </li>
        <li>
          <Link href="/client/components">Components</Link> — Feature,
          FeatureGate, FeatureSwitch, FeatureVariant
        </li>
      </ul>
    </>
  )
}
