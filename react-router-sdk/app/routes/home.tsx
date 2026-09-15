import { useFeatureFlags } from '@ops-ai/react-router-toggly/client'
import { Link } from 'react-router'

const flags = ['new-dashboard', 'api-v2', 'enhanced-submit', 'ExpressCheckout', 'beta-access']

export default function Home() {
  const snapshot = useFeatureFlags()
  return (
    <>
      <h1>React Router SDK Sample</h1>
      <p>
        Follow one toggle from the configuration in <code>app/lib/toggly.server.ts</code> through a loader or browser gate.
        Definitions describe rules; evaluation applies those rules to a request, identity, and optional Order.
      </p>
      <h2>Showcase map</h2>
      <ul>
        <li><Link to="/gates">Declarative gates</Link> — feature, negate, multi-key, and the published boolean-mapped A/B label.</li>
        <li><Link to="/programmatic">Programmatic API</Link> — loader and action helpers.</li>
        <li><Link to="/identity">Request identity</Link> — a cookie becomes an async request context, never a shared client mutation.</li>
        <li><Link to="/orders">Order context</Link> — VIP ExpressCheckout evaluation.</li>
        <li><Link to="/filters">Filters matrix</Link> — matching and non-matching request inputs.</li>
      </ul>
      <h2>Flag checklist</h2>
      <ul>{flags.map((key) => <li key={key}><code>{key}</code>: {String(snapshot[key])}</li>)}</ul>
      <h2>Live snapshot</h2>
      <pre>{JSON.stringify(snapshot, null, 2)}</pre>
      <p>Initial values are defaults or hydrated flags. A snapshot is not proof that your dashboard app, rules, origins, or connection are configured correctly.</p>
    </>
  )
}
