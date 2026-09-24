import { Feature, useFeatureFlag, useFeatureGate, useVariant } from '@ops-ai/astro-feature-flags-toggly/react';
import { flushTelemetry, incrementCounter, recordUsage, recordView, setGauge } from '@ops-ai/astro-feature-flags-toggly/client/store';

/**
 * React island — uses the published /react export (Feature + hooks).
 * Hydrates against the client store initialized by the integration inject
 * (`/client/setup`), not a guessed `/client` togglyStore path.
 */
export default function ReactIsland() {
  const dashboard = useFeatureFlag('new-dashboard');
  const anyGate = useFeatureGate(['new-dashboard', 'api-v2'], 'any');
  const variant = useVariant('new-dashboard');

  function recordDemoTelemetry() {
    if (!dashboard.isReady) return;
    const selected = dashboard.enabled ? variant?.name ?? 'enabled' : 'disabled';
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(selected)) return;
    recordUsage('new-dashboard', selected);
    recordView('new-dashboard', selected);
    incrementCounter('sample-interactions', 1);
    setGauge('sample-active-panel', 1);
  }

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
      <button id="record-demo-telemetry" type="button" onClick={recordDemoTelemetry}>
        Record demo usage, view, counter and gauge
      </button>
      <button id="flush-demo-telemetry" type="button" onClick={() => void flushTelemetry()}>
        Send queued demo telemetry
      </button>
    </section>
  );
}
