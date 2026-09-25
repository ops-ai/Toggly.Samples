<script>
  import { getContext } from "svelte";
  import { createVariantStore } from "@ops-ai/svelte-feature-flags-toggly";
  import { workshopKey } from "../sample/workshop";
  let { section } = $props();
  const workshop = getContext(workshopKey);
  const session = workshop.session;
  // createVariantStore reads the createToggly-owned variants store. This
  // workshop keeps entity-gate payloads on that owner, so this derived store
  // stays empty unless you set enableVariants on the same createToggly call.
  const mainVariantStore = createVariantStore("new-dashboard");
  let routeMessage = $state("The beta view has not been opened.");
  async function visitBeta() {
    routeMessage = (await workshop.enterBeta())
      ? "Beta view opened (demo navigation)"
      : "Beta view denied — existing home stays visible";
  }
</script>

{#if section === "programmatic"}
  <section id="programmatic" class="panel">
    <div class="section-top">
      <span class="number">03</span>
      <h2>Check before an action</h2>
    </div>
    <p>
      <code>await isFeatureOn('enhanced-submit')</code> branches at the action
      boundary. This sample only prints a result; your server must still
      authorize real mutations.
    </p>
    <button
      onclick={() => workshop.check()}
      disabled={$session.busy}
      data-testid="check-action"
    >
      Run programmatic check
    </button>
    <p role="status" data-testid="action-result">{$session.checkResult}</p>
  </section>
{/if}

{#if section === "native"}
  <section id="native" class="panel">
    <div class="section-top">
      <span class="number">08</span>
      <h2>Svelte-specific building blocks</h2>
    </div>
    <div class="cards">
      <article>
        <h3>Device-local prerequisite</h3>
        <p>
          A local gate ANDs with the remote result; it cannot turn a remotely
          disabled flag on.
        </p>
        <button
          onclick={() => workshop.local()}
          disabled={$session.busy}
          data-testid="local-toggle"
        >
          Device prerequisite: {$session.localAllowed ? "ready" : "not ready"}
        </button>
        <p>
          Watch the enhanced-submit builder above react to
          <code>notifyLocalGatesChanged()</code>.
        </p>
      </article>
      <article>
        <h3>Compose a navigation check</h3>
        <p>
          This browser package has no router guard export. This button composes
          the real <code>isFeatureOn</code> helper to keep a denied view closed.
        </p>
        <button
          onclick={visitBeta}
          disabled={$session.busy}
          data-testid="beta-route"
        >
          Open beta view
        </button>
        <p data-testid="route-result">{routeMessage}</p>
      </article>
      <article>
        <h3>Loading, defaults and errors</h3>
        <p>
          Failed refreshes keep last-known-good flags after a successful load;
          this workshop still shows the error and denies defaults when the first
          load fails.
        </p>
        <button
          onclick={() => workshop.failure()}
          disabled={!$session.offline || $session.busy}
          data-testid="transport-error"
        >
          {$session.simulateError
            ? "Recover offline transport"
            : "Simulate transport failure"}
        </button>
        <p>
          Main-store variant:
          <strong data-testid="main-variant-store">
            {$mainVariantStore?.name || "none (enableVariants is off here)"}
          </strong>
        </p>
      </article>
    </div>
    <p>
      Read <code>src/main.js</code> for <code>createToggly</code>,
      <code>TemplateGates.svelte</code> for native Feature/stores, and
      <code>sample/workshop.js</code> for service orchestration. Do not copy
      SvelteKit hooks or actions into this browser-only sample.
    </p>
  </section>
{/if}
