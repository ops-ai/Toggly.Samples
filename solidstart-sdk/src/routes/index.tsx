import { A, createAsync, useSearchParams } from '@solidjs/router';
import { For, Show, createSignal, lazy, Suspense } from 'solid-js';
import {
  Feature,
  TogglyProvider,
  useFeatureFlag,
  useToggly,
  type TogglySnapshot,
} from '@ops-ai/solid-feature-flags-toggly';
import { keys, order } from '../catalog';
import { getFlags } from '../lib/flags';
import '../style.css';
const Panel = lazy(() => import('../Panel'));
function Workshop(props: {
  snapshot: TogglySnapshot;
  matching: boolean;
  backendConfigured: boolean;
}) {
  const t = useToggly();
  const dashboard = useFeatureFlag('new-dashboard');
  const [vip, setVip] = createSignal(true);
  const [device, setDevice] = createSignal(true);
  const [result, setResult] = createSignal('Choose an API exercise.');
  // Local conditions narrow a remotely enabled flag. They never turn a remote false on.
  t.client.setLocalGates([
    { id: 'device-ready', flagKeys: ['enhanced-submit'], isEnabled: () => device() },
  ]);
  const submit = async () => {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matching: props.matching }),
    });
    setResult(
      response.ok ? (await response.json()).message : `Server guard returned ${response.status}.`,
    );
  };
  return (
    <main>
      <header>
        <p>Toggly × SolidStart</p>
        <h1>Feature flag workshop</h1>
        <p>Server evaluation, signed public hydration, and fine-grained browser updates.</p>
      </header>
      <nav>
        <For
          each={[
            'Home',
            'Declarative gates',
            'Programmatic API',
            'Identity',
            'Entity context',
            'Filters matrix',
            'SolidStart boundaries',
            'Configuration',
          ]}
        >
          {(name, i) => <a href={`#section-${i()}`}>{name}</a>}
        </For>
      </nav>
      <section id="section-0">
        <h2>Home</h2>
        <p>
          A key identifies a decision. The environment chooses its definitions. Initialization loads
          signed public results; missing keys return false. This page starts with the server
          snapshot and refreshes after hydration.
        </p>
        <p>
          Snapshot source: <strong>{props.snapshot.source}</strong> · Browser request:{' '}
          {t.loading() ? 'loading' : 'settled'}
        </p>
        <Show when={t.error()}>
          <p role="status">
            Refresh failed; the previous verified state or defaults remain active.
          </p>
        </Show>
        <details open>
          <summary>Flag checklist and live public snapshot</summary>
          <pre>{JSON.stringify(t.flags(), null, 2)}</pre>
        </details>
        <p>
          First toggle: enable <code>new-dashboard</code> in the frontend application's selected
          environment; the enabled dashboard below appears after the live notification or Refresh.
          Disable it to restore the fallback.
        </p>
      </section>
      <section id="section-1">
        <h2>Declarative gates</h2>
        <Feature
          feature="new-dashboard"
          fallback={<p>Classic dashboard</p>}
          loading={<p>Loading dashboard flags…</p>}
        >
          <p>New dashboard</p>
        </Feature>
        <Feature feature="new-dashboard" negate>
          <p>Negated branch: classic experience.</p>
        </Feature>
        <Feature feature={['new-dashboard', 'api-v2']} requirement="all">
          <p>All: new dashboard with API v2</p>
        </Feature>
        <Feature feature={['new-dashboard', 'api-v2']} requirement="any">
          <p>Any: at least one rollout is enabled</p>
        </Feature>
        <Feature feature="beta-access" fallback={<p>Lazy beta panel is gated.</p>}>
          <Suspense fallback={<p>Loading panel…</p>}>
            <Panel />
          </Suspense>
        </Feature>
        <p>These boolean branches are not experiment variant assignment.</p>
      </section>
      <section id="section-2">
        <h2>Programmatic API</h2>
        <p>Reactive accessor: new-dashboard = {String(dashboard())}</p>
        <button
          onClick={() => setResult(`Any gate: ${t.evaluate(['new-dashboard', 'api-v2'], 'any')}`)}
        >
          Evaluate any
        </button>
        <button onClick={() => void t.client.refresh()}>Refresh</button>
        <button onClick={() => void submit()}>Run server action</button>
        <output>{result()}</output>
        <p>
          The action independently evaluates <code>enhanced-submit</code> on the server. Hiding a
          button is presentation, never authorization.
        </p>
      </section>
      <section id="section-3">
        <h2>Identity</h2>
        <A href="/?preset=matching">Matching</A> <A href="/?preset=non-matching">Non-matching</A>
        <pre>{JSON.stringify(props.snapshot.context, null, 2)}</pre>
        <p>
          Navigation invokes a fresh server query. Each request copies identity, groups and claims;
          it never changes the shared backend client identity. Alice/staff/admin and Bob/no
          groups/user are synthetic teaching presets.
        </p>
      </section>
      <section id="section-4">
        <h2>Entity context</h2>
        <label>
          <input
            type="checkbox"
            checked={vip()}
            onChange={(e) => setVip(e.currentTarget.checked)}
          />{' '}
          Order.Vip
        </label>
        <Feature
          feature="ExpressCheckout"
          entity={order(vip())}
          fallback={<p>Standard checkout</p>}
        >
          <p>Express checkout for this VIP order</p>
        </Feature>
        <p>
          Register an Order context with a boolean Vip property. Each entity evaluation receives
          this order; another order's attributes do not become global targeting.
        </p>
      </section>
      <section id="section-5">
        <h2>Filters matrix</h2>
        <p>
          Use Matching / Non-matching above with the presets in docs/FLAG_TEMPLATE.md. Identity,
          groups and claims change here. Browser/OS/language/country use real request context;
          changing the preset cannot spoof your browser or country. Time windows use server time;
          percentage buckets are stable per identity.
        </p>
        <table>
          <thead>
            <tr>
              <th>Definition key</th>
              <th>Current evaluated result</th>
            </tr>
          </thead>
          <tbody>
            <For each={keys.filter((key) => key.startsWith('filter-'))}>
              {(key) => (
                <tr>
                  <td>{key}</td>
                  <td>{String(t.evaluate([key], 'all', false, order(vip())))}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <p>
          Configure percentage at 100/0 and a current/expired time window to verify both outcomes.
          Context-property uses the Order.Vip control. Missing definitions remain false.
        </p>
      </section>
      <section id="section-6">
        <h2>SolidStart boundaries</h2>
        <p>
          The server import supplies backend gates and an explicit allowlist for a separately signed
          frontend snapshot. The browser provider starts transport on mount and disposes it when
          leaving this route.
        </p>
        <label>
          <input
            type="checkbox"
            checked={device()}
            onChange={(e) => {
              setDevice(e.currentTarget.checked);
              t.client.notifyLocalGatesChanged();
            }}
          />{' '}
          Device ready (browser-local enhanced-submit gate)
        </label>
        <Feature feature="enhanced-submit" fallback={<p>Local or remote submit gate is closed.</p>}>
          <p>Browser submit presentation is available.</p>
        </Feature>
        <A href="/about">Leave workshop to dispose provider</A>
        <p>
          Request handlers dispose only their wrapper; the process owner closes the shared Node
          client on shutdown. SolidStart handles query serialization; use serializeSnapshot only for
          manually authored inline scripts.
        </p>
      </section>
      <section id="section-7">
        <h2>Configuration</h2>
        <Show when={!import.meta.env.VITE_TOGGLY_APP_KEY}>
          <p role="alert">
            Missing frontend app key. Public defaults are shown. Add VITE_TOGGLY_APP_KEY and restart
            the build.
          </p>
        </Show>
        <Show when={!props.backendConfigured}>
          <p role="alert">Missing backend app key. Server actions use explicit demo defaults.</p>
        </Show>
        <p>
          Set TOGGLY_BACKEND_APP_KEY on the server for backend gates. VITE_ values are public
          build-time configuration; never put the backend key in them. Empty keys use explicit demo
          defaults; the server guard still evaluates those defaults. Use separate frontend and
          backend keys from your Toggly applications.
        </p>
        <a href="https://docs.toggly.io/sdks/javascript/solidstart">SolidStart SDK guide</a>
      </section>
    </main>
  );
}
export default function Home() {
  const [params] = useSearchParams();
  const matching = () => params.preset !== 'non-matching';
  const data = createAsync(() => getFlags(matching()));
  const snapshot = () => data()?.snapshot;
  return (
    <Show when={snapshot()}>
      {(initial) => (
        <TogglyProvider
          snapshot={snapshot() ?? initial()}
          config={{
            appKey: import.meta.env.VITE_TOGGLY_APP_KEY,
            environment: import.meta.env.VITE_TOGGLY_ENVIRONMENT ?? 'Production',
            baseURI: import.meta.env.VITE_TOGGLY_BASE_URL,
            // Defining callbacks during SSR is safe; only the mounted browser calls them.
            storage: {
              getItem: (key: string) => window.localStorage.getItem(key),
              setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
            },
          }}
        >
          <Workshop
            snapshot={snapshot() ?? initial()}
            matching={matching()}
            backendConfigured={data()?.backendConfigured ?? false}
          />
        </TogglyProvider>
      )}
    </Show>
  );
}
