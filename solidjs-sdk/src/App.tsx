import { createSignal, For, Show, Suspense } from 'solid-js';
import { Feature, TogglyProvider, useFeatureFlag, useToggly, type TogglyOptions } from '@ops-ai/solid-feature-flags-toggly';
import { defaults, keys, order, presets, sections } from './catalog';

function Workshop(props: { configured: boolean }) {
  const toggly = useToggly();
  const [identity, setIdentity] = createSignal('');
  const [vip, setVip] = createSignal(true);
  const [deviceReady, setDeviceReady] = createSignal(true);
  const [result, setResult] = createSignal('Run a check to observe a current result.');
  const [submitted, setSubmitted] = createSignal(false);
  const dashboard = useFeatureFlag('new-dashboard');
  // The entity is supplied at the read boundary; it never changes global identity.
  const checkout = useFeatureFlag('ExpressCheckout', () => order(vip()));
  // A device prerequisite can only narrow a remotely enabled feature.
  toggly.client.setLocalGates([{id:'device',flagKeys:['api-v2'],isEnabled:deviceReady}]);
  const apply = async (matching: boolean) => {
    const preset = presets[matching ? 'Matching' : 'Non-matching'];
    setIdentity(preset.identity); setVip(matching);
    await toggly.client.setContext(preset);
  };
  return <main>
    <header><p class="eyebrow">Toggly × SolidJS</p><h1>Feature flag workshop</h1><p>Trace a flag from configuration to a reactive UI branch.</p></header>
    <Show when={!props.configured}><aside role="status">No app key configured. Offline defaults are active; remote targeting and entity conditions require your Toggly application.</aside></Show>
    <nav aria-label="Workshop sections"><For each={sections}>{(name,index) => <a href={`#section-${index()}`}>{name}</a>}</For></nav>
    <section id="section-0"><h2>1. Home</h2><p>A key names a feature; an environment supplies its definitions. Initialization fetches signed evaluated definitions and accessors read the resulting snapshot.</p>
      <p>First toggle: enable <code>new-dashboard</code> in Production, then refresh. “New dashboard” appears; disabling it shows “Classic dashboard”. Without a key, the documented default stays on.</p>
      <button onClick={() => toggly.client.refresh()} disabled={toggly.loading()}>Refresh definitions</button>
      <p aria-live="polite">{toggly.loading() ? 'Refreshing…' : 'Snapshot available'} {toggly.error()?.message}</p>
      <details><summary>Application flag checklist</summary><ul><For each={keys}>{key => <li><code>{key}</code></li>}</For></ul></details>
      <pre aria-label="Live snapshot">{JSON.stringify(toggly.flags(),null,2)}</pre>
    </section>
    <section id="section-1"><h2>2. Declarative gates</h2>
      <Feature feature="new-dashboard" loading={<p>Loading dashboard…</p>} fallback={<p>Classic dashboard</p>}><p>New dashboard</p></Feature>
      <Feature feature="new-dashboard" negate><p>The negated gate is visible.</p></Feature>
      <Feature feature={['new-dashboard','api-v2']} requirement="all" fallback={<p>The all gate is closed.</p>}><p>Both dashboard and API v2 are enabled.</p></Feature>
      <Feature feature={['new-dashboard','beta-access']} requirement="any"><p>At least one feature is enabled.</p></Feature>
      <p>Boolean alternative: <strong>{dashboard() ? 'New experience' : 'Classic experience'}</strong>. This is not a variant assignment; this SDK exposes no experiment assignment API.</p>
    </section>
    <section id="section-2"><h2>3. Programmatic API</h2>
      <button onClick={() => setResult(`new-dashboard: ${toggly.evaluate(['new-dashboard'])}`)}>Evaluate dashboard</button><output>{result()}</output>
      <button onClick={() => { if (toggly.evaluate(['enhanced-submit'])) setSubmitted(true); }} disabled={!toggly.evaluate(['enhanced-submit'])}>Try enhanced submit</button>
      <p>{submitted() ? 'Local demonstration submitted.' : 'No submission yet.'} A production server must authorize its own operation.</p>
    </section>
    <section id="section-3"><h2>4. Identity</h2><p>Targeting belongs to this provider. Changing identity clears prior results immediately. Demo claims are not authentication.</p>
      <label>Identity <input value={identity()} onInput={event => setIdentity(event.currentTarget.value)} /></label>
      <button onClick={() => toggly.client.setContext({identity:identity()})}>Apply identity</button>
      <button onClick={() => {setIdentity(''); void toggly.client.setContext({identity:'',groups:[],claims:{}});}}>Clear identity, groups and claims</button>
      <button onClick={() => apply(true)}>Matching preset</button><button onClick={() => apply(false)}>Non-matching preset</button>
      <p>Matching uses alice / staff / role=admin; Non-matching uses bob / no groups / role=user.</p>
    </section>
    <section id="section-4"><h2>5. Entity context</h2><label><input type="checkbox" checked={vip()} onChange={event => setVip(event.currentTarget.checked)} />VIP order</label>
      <pre>{JSON.stringify(order(vip()),null,2)}</pre><p>ExpressCheckout: {String(checkout())}</p>
      <Feature feature="ExpressCheckout" entity={order(vip())} fallback={<p>Standard checkout</p>}><p>Express checkout for this VIP order</p></Feature>
      <p>Bind ExpressCheckout to Order and configure Vip = true. Missing entity definitions fail closed; no-key defaults do not simulate these conditions.</p>
    </section>
    <section id="section-5"><h2>6. Filters matrix</h2><p>Apply the presets above, then inspect each real result. Percentage is sticky by identity, so neither preset promises a particular percentage result. Country, browser, language, device and OS use your actual request; these controls cannot spoof browser headers.</p>
      <table><thead><tr><th>Flag</th><th>Current result</th><th>Input source</th></tr></thead><tbody><For each={keys.filter(key => key.startsWith('filter-'))}>{key => <tr><td>{key}</td><td>{String(toggly.evaluate([key],'all',false,order(vip())))}</td><td>{key==='filter-context-property' ? 'Order.Vip' : ['filter-targeting','filter-user-claims','filter-percentage'].includes(key) ? 'Identity / claims' : 'Service rule and actual browser request'}</td></tr>}</For></tbody></table>
    </section>
    <section id="section-6"><h2>7. Solid ownership</h2><p>Native accessors update consumers when results change. Provider disposal aborts pending fetches, clears timers, and closes WebSockets. Gate branches are lazy and preserve Solid ownership.</p>
      <label><input type="checkbox" checked={deviceReady()} onChange={event => {setDeviceReady(event.currentTarget.checked); toggly.client.notifyLocalGatesChanged();}} />Device ready for API v2</label>
      <Feature feature="api-v2" fallback={<p>API v2 held by remote or local gate.</p>}><p>API v2 ready.</p></Feature>
      <Suspense fallback={<p>Initial resource loading…</p>}><ResourceView /></Suspense>
      <p>The resource observes initialization; the live snapshot above observes later refreshes. This browser sample makes no SolidStart SSR claim.</p>
    </section>
    <section id="section-7"><h2>8. Configuration</h2><p>{props.configured ? 'Live browser application configured.' : 'Missing VITE_TOGGLY_APP_KEY: copy .env.example to .env and set your application key.'}</p>
      <p>VITE_ variables are public and substituted during the Vite build. Use Production and allow http://localhost:5173 in Toggly. Restart the dev server after editing .env.</p>
      <p>Signatures are verified by default. Network failures retain same-session data or defaults; errors are visible above. Cache is in memory in this sample; no identity or definitions are persisted to browser storage.</p>
    </section>
  </main>;
}
function ResourceView() { const toggly=useToggly(); return <p>Initial resource keys: {Object.keys(toggly.resource() ?? {}).length}</p>; }
export default function App(props: { config?: TogglyOptions } = {}) {
  // Only browser application identifiers belong in VITE_ variables, never secrets.
  const config = props.config ?? {appKey:import.meta.env.VITE_TOGGLY_APP_KEY || undefined,environment:import.meta.env.VITE_TOGGLY_ENVIRONMENT || 'Production',flagDefaults:defaults};
  return <TogglyProvider config={config}><Workshop configured={Boolean(config.appKey)} /></TogglyProvider>;
}
