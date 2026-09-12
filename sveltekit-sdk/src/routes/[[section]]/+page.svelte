<script lang="ts">
  import { getContext } from 'svelte';
  import { page } from '$app/stores';
  import type { TogglyStore } from '@ops-ai/toggly-sveltekit';
  import Feature from '@ops-ai/toggly-sveltekit/Feature.svelte';
  import { sections, vip, standard } from '$lib/catalog';
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;
  // Read the layout-owned instance; creating a module-level store would let
  // requests/users share mutable state during SSR.
  const toggly = getContext<TogglyStore>('toggly');
  const localGate = getContext<{
    isEnabled: () => boolean;
    toggle: () => void;
  }>('localGate');
  $: localReady = $toggly && localGate.isEnabled();
  $: section = $page.params.section ?? 'home';
  // Read the instance store so programmatic values update after navigation and signed refresh.
  $: dashboard = $toggly && toggly.isEnabled('new-dashboard');
</script>

<p class="eyebrow">SVELTEKIT SDK SAMPLE</p>
<h1>
  {section === 'home'
    ? 'A flag, from server to screen.'
    : section[0].toUpperCase() + section.slice(1)}
</h1>
{#if section === 'home'}
  <p>
    Explore a complete feature flag journey: evaluate once with request context, hydrate the same
    result, then receive signed browser updates.
  </p>
  <div class="card">
    <h2>Start with your first toggle</h2>
    <p>
      Configure <code>new-dashboard</code> as Available to Client SDK. Switch it ON in Production and
      watch the enabled card appear in Declarative. Switch it OFF and the negated Feature block appears.
      With empty keys, this sample uses the labelled offline fixture instead.
    </p>
  </div>
  <div class="card">
    <h2>Live frontend snapshot</h2>
    <pre>{JSON.stringify($toggly.definitions, null, 2)}</pre>
    <p>
      Allowlisted frontend values only. Raw backend rules and backend App Keys never enter this
      snapshot.
    </p>
  </div>
  <div class="card">
    <h2>Explore the source</h2>
    {#each sections.slice(1) as target}<p>
        <a href="/{target}">{target}</a> — an executable view with the matching source in
        <code>src/routes/[[section]]/+page.svelte</code>.
      </p>{/each}
  </div>
{:else if section === 'declarative'}
  <p>
    Feature gates select visible content. These boolean branches are not experiment assignments.
  </p>
  <!-- Matching Feature blocks use the same snapshot; negate selects disabled
      content immediately during SSR and hydration, without waiting for a fetch. -->
  <Feature {toggly} feature="new-dashboard"
    ><div class="card" data-testid="dashboard-on">
      <h2>New dashboard enabled</h2>
      <p>The server and first browser render use the same snapshot.</p>
    </div>
  </Feature>
  <Feature {toggly} feature="new-dashboard" options={{ negate: true }}>
    <div class="card" data-testid="dashboard-off">
      Classic dashboard — the negated Feature block.
    </div></Feature
  >
  <!-- Negate reverses this boolean gate; it does not create an experiment variant. -->
  <Feature {toggly} feature="api-v2" options={{ negate: true }}
    ><div class="card">Negate: API v1 remains visible while api-v2 is off.</div></Feature
  >
  <!-- any accepts either enabled feature; the default requirement is all. -->
  <Feature {toggly} feature={['new-dashboard', 'api-v2']} options={{ requirement: 'any' }}
    ><div class="card">Any: one of these two flags is sufficient.</div></Feature
  >
  <div class="card">
    <h2>Variant boundary</h2>
    <p>
      This SDK exposes boolean and entity gates. It does not assign A/B variants; do not label ON
      and OFF as experiment groups or invent a variant identifier.
    </p>
  </div>
{:else if section === 'programmatic'}
  <!-- Notify the existing store when a device prerequisite changes. A local
      gate can disable remote access, but cannot turn a remote false into true. -->
  <p>Use the same layout-owned store in event handlers and derived UI values.</p>
  <button on:click={() => localGate.toggle()}>Toggle device prerequisite</button>
  <p>
    Device ready: {String(localReady)}. Local gates cannot enable a remotely disabled flag.
  </p>
  <div class="card">
    <code>toggly.isEnabled('new-dashboard')</code>
    <p class:on={dashboard} class:off={!dashboard}>
      {dashboard ? 'Enabled' : 'Disabled'}
    </p>
    <p>
      All: {toggly.gate(['new-dashboard', 'api-v2'])}; any: {toggly.gate(
        ['new-dashboard', 'api-v2'],
        { requirement: 'any' },
      )}; missing default: {toggly.isEnabled('missing', { defaultValue: true })}
    </p>
  </div>
{:else if section === 'identity'}
  <!-- GET navigation reruns the server load. Never call setIdentity on the
      shared backend client while handling one visitor's request. -->
  <p>
    The server hook creates one immutable context per request. Changing the demo preset navigates
    with new server data; the layout replaces its browser session.
  </p>
  <form method="GET">
    <button name="preset" value="matching">Matching · alice</button>
    <button name="preset" value="non-matching">Non-matching · bob</button>
  </form>
  <pre>{JSON.stringify(data.context, null, 2)}</pre>
  <p>
    Demo role claims are not authentication. Production claims come from your authenticated server
    session; expose only public targeting attributes.
  </p>
{:else if section === 'entity'}
  <!-- Pass the entity at this callsite so the retained frontend EntityGate can
      evaluate Vip. Without an entity, an entity-bound flag fails closed. -->
  <p>
    Express Checkout evaluates the same flag with two Order instances; a global boolean would lose
    this distinction.
  </p>
  <div class="card">
    <table>
      <thead
        ><tr><th>Entity</th><th>Vip</th><th>Server result</th><th>Browser result</th></tr></thead
      ><tbody
        >{#each [vip, standard] as order}<tr
            ><td>{order.key}</td><td>{String(order.attributes.Vip)}</td><td
              >{String(order === vip ? data.vipEnabled : data.standardEnabled)}</td
            ><td>{String(toggly.isEnabled('ExpressCheckout', { entity: order }))}</td></tr
          >{/each}</tbody
      >
    </table>
    <p>
      Offline frontend defaults omit ExpressCheckout, so its browser result is false until live
      frontend definitions supply the entity gate. Server fixture results use the real Node
      evaluator.
    </p>
  </div>
{:else if section === 'filters'}
  <p>
    These results use the server's request-bound Node evaluator. Browser segment results use the
    browser's actual headers after hydration.
  </p>
  <form method="GET">
    <button name="preset" value="matching">Matching preset</button>
    <button name="preset" value="non-matching">Non-matching preset</button>
  </form>
  <div class="card">
    <table>
      <thead><tr><th>Flag</th><th>Evaluated result</th></tr></thead><tbody
        >{#each data.matrix as row}<tr
            ><td><code>{row.key}</code></td><td class:on={row.enabled} class:off={!row.enabled}
              >{row.enabled ? 'ON' : 'OFF'}</td
            ></tr
          >{/each}</tbody
      >
    </table>
    <p>
      AlwaysOn and the open TimeWindow remain ON for both presets. Percentage is sticky by identity;
      its result is not prescribed by the preset name.
    </p>
  </div>
{:else if section === 'framework'}
  <!-- The form submits to a server action that checks enhanced-submit again.
      A hidden button alone would not protect direct HTTP requests. -->
  <p>
    Hooks bind context, the framework route load requires beta-access, and actions enforce
    enhanced-submit again before work.
  </p>
  <div class="card">
    <h2>Guarded server action</h2>
    <form method="POST" action="?/submit">
      <button>Submit enhanced action</button>
    </form>
    {#if form?.message}<p role="status">{form.message}</p>{/if}
    <p>
      Turn enhanced-submit off to receive HTTP 404 from the action. Keep your existing authorization
      check alongside the feature gate.
    </p>
  </div>
  <div class="card">
    <h2>Lifecycle</h2>
    <p>
      The layout starts refresh and a WebSocket in onMount; onDestroy stops its polling and socket.
      Navigation replaces the request snapshot immediately and rejects results from the previous
      browser session.
    </p>
    <p>
      Initial support is adapter-node. Prerender captures build-time defaults; personalized pages
      and server actions require a running server.
    </p>
  </div>
{:else}<p>Choose a section from the navigation.</p>{/if}
