import { ClientGates } from '../components/client-gates'

export default function Gates() {
  return (
    <>
      <h1>Declarative gates</h1>
      <ClientGates />
      <section>
        <h2>Variant boundary</h2>
        <p>
          The published React Router client exposes <code>useABTest</code>, which chooses one of two labels from a boolean flag.
          It does not expose a dashboard experiment assignment or a <code>FeatureVariant</code> component.
          Treat the label as a UI branch, not experiment analytics or cohort allocation.
        </p>
      </section>
    </>
  )
}
