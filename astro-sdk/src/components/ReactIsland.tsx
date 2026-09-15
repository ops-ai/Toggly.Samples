import { Feature, useFeatureFlag, useFeatureGate, useVariant } from '@ops-ai/astro-feature-flags-toggly/react';

/**
 * React island — uses the published /react export (Feature + hooks).
 * Hydrates against the client store initialized by the integration inject
 * (`/client/setup`), not a guessed `/client` togglyStore path.
 */
export default function ReactIsland() {
  const dashboard = useFeatureFlag('new-dashboard');
  const anyGate = useFeatureGate(['new-dashboard', 'api-v2'], 'any');
  const variant = useVariant('new-dashboard');

  return (
    <section id="react-island" className="island">
      <h3>React island</h3>
      <p>
        ready: <code>{String(dashboard.isReady)}</code>
      </p>
      <Feature flag="new-dashboard">
        <p id="react-dashboard-on">React: new-dashboard ON ({String(dashboard.enabled)})</p>
      </Feature>
      <Feature flag="new-dashboard" negate>
        <p id="react-dashboard-off">React: new-dashboard OFF</p>
      </Feature>
      <p id="react-any-gate">
        any(new-dashboard, api-v2): <code>{String(anyGate.enabled)}</code>
      </p>
      <p id="react-variant">
        variant: <code>{variant?.name ?? 'none'}</code>
      </p>
    </section>
  );
}
