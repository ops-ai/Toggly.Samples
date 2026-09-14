import { Feature, FeatureGate, FeatureSwitch, useABTest, useFeature, useToggly } from '@ops-ai/remix-toggly-client'

export function ClientGates() {
  const direct = useFeature('new-dashboard', false)
  const { isReady, refresh } = useToggly()
  // The published client has useABTest, but it maps a boolean to labels. It
  // does not expose a dashboard experiment/variant assignment object.
  const booleanMappedLabel = useABTest('new-dashboard', 'modern', 'classic')
  return <section><h2>Browser package: declarative gates</h2><p>These are presentation choices only. A server action must still enforce any authorization rule.</p>
    <Feature featureKey="new-dashboard"><p className="on">Feature: new dashboard is ON.</p></Feature>
    <Feature featureKey="new-dashboard" negate><p className="off">Negate: legacy dashboard is shown while the flag is OFF.</p></Feature>
    <FeatureSwitch featureKey="new-dashboard" enabled={<p className="on">Switch: enabled branch</p>} disabled={<p className="off">Switch: disabled branch</p>} />
    <FeatureGate featureKeys={['new-dashboard', 'api-v2']} requirement="all"><p className="on">Multi-key all gate: both new-dashboard and api-v2 are on.</p></FeatureGate>
    <p><b>Programmatic client hook:</b> {String(direct)}; provider ready: {String(isReady)}; boolean-mapped “variant”: {booleanMappedLabel}.</p>
    <button onClick={() => void refresh()}>Refresh browser flags</button>
  </section>
}
