'use client'

import {
  Feature,
  FeatureGate,
  FeatureSwitch,
  FeatureVariant,
} from '@ops-ai/nextjs-toggly-client'

// The provider owns asynchronous state; loading UI prevents treating "not yet
// loaded" as a deliberate disabled result. negate inverts the combined gate.
// FeatureVariant and FeatureSwitch choose boolean UI branches, not A/B cohorts.
function ComponentsDemo() {
  return (
    <>
      <div className="card">
        <h2>Feature</h2>
        <Feature
          featureKey="new-dashboard"
          loading={<p className="muted">Loading…</p>}
        >
          <p className="on">Feature: new-dashboard ON</p>
        </Feature>
        <Feature
          featureKey="new-dashboard"
          negate
          loading={<p className="muted">Loading…</p>}
        >
          <p className="off">Feature negate: new-dashboard OFF</p>
        </Feature>
      </div>

      <div className="card">
        <h2>FeatureGate (all)</h2>
        <FeatureGate
          featureKeys={['new-dashboard', 'api-v2']}
          requirement="all"
          loading={<p className="muted">Loading gate…</p>}
        >
          <p className="on">Both new-dashboard and api-v2 ON</p>
        </FeatureGate>
        <FeatureGate
          featureKeys={['new-dashboard', 'api-v2']}
          requirement="all"
          negate
          loading={<p className="muted">Loading gate…</p>}
        >
          <p className="off">Gate failed (not both ON)</p>
        </FeatureGate>
      </div>

      <div className="card">
        <h2>FeatureSwitch</h2>
        <FeatureSwitch
          featureKey="new-dashboard"
          cases={{
            on: <p className="on">Switch: new-dashboard ON</p>,
            off: <p className="off">Switch: new-dashboard OFF</p>,
            loading: <p className="muted">Loading switch…</p>,
          }}
        />
      </div>

      <div className="card">
        <h2>FeatureVariant</h2>
        <FeatureVariant
          featureKey="new-dashboard"
          enabled={<p className="on">Variant enabled</p>}
          disabled={<p className="off">Variant disabled</p>}
          loading={<p className="muted">Loading variant…</p>}
        />
      </div>
    </>
  )
}

export default function ClientComponentsPage() {
  const hasKey = Boolean(process.env.NEXT_PUBLIC_TOGGLY_APP_KEY?.trim())

  if (!hasKey) {
    return (
      <>
        <h1>Client components</h1>
        <p className="muted">
          Provider is inactive without NEXT_PUBLIC_TOGGLY_APP_KEY — components
          are not mounted.
        </p>
      </>
    )
  }

  return (
    <>
      <h1>Client components</h1>
      <p>
        Client <code>Feature</code>, <code>FeatureGate</code>,{' '}
        <code>FeatureSwitch</code>, and <code>FeatureVariant</code>.
      </p>
      <ComponentsDemo />
    </>
  )
}
