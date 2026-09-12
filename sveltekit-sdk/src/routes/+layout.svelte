<script lang="ts">
  import { onMount, onDestroy, setContext } from "svelte";
  import { createToggly } from "@ops-ai/toggly-sveltekit";
  import { sections } from "$lib/catalog";
  import type { LayoutData } from "./$types";
  export let data: LayoutData;
  // Synchronous SSR seed avoids a disabled branch flashing before hydration; each layout owns its store.
  let deviceReady = true;
  const toggly = createToggly(data.toggly, {
    appKey: data.publicKey,
    environment: data.environment,
    localGates: [
      {
        id: "device",
        flagKeys: ["new-dashboard"],
        isEnabled: () => deviceReady,
      },
    ],
  });
  // A device prerequisite can only disable a remotely enabled flag; it is owned by this layout.
  setContext("localGate", {
    isEnabled: () => deviceReady,
    toggle: () => {
      deviceReady = !deviceReady;
      toggly.notifyLocalGatesChanged();
    },
  });
  setContext("toggly", toggly);
  $: toggly.update(data.toggly);
  onMount(() => {
    void toggly.start();
  });
  onDestroy(() => toggly.dispose());
</script>
<svelte:head><title>Toggly · SvelteKit feature flags</title><meta name="description" content="Explore request-scoped feature flags, server actions, hydration and entity contexts with Toggly."/></svelte:head>
<div class="shell"><aside><a class="brand" href="/">toggly<span> / SvelteKit</span></a><p class="eyebrow">FEATURE FLAGS IN PRACTICE</p><nav>{#each sections as section}<a href="/{section==='home'?'':section}?preset={data.matching?'matching':'non-matching'}">{section[0].toUpperCase()+section.slice(1)}</a>{/each}</nav><p class="footnote">Node adapter · Svelte 5<br/>Request → snapshot → browser</p></aside><main>{#if data.offline}<div class="banner" role="status">Offline demonstration · Set TOGGLY_APP_KEY and PUBLIC_TOGGLY_APP_KEY to connect your application. Fixtures are not live dashboard state.</div>{/if}<slot/></main></div>
<style>
 :global(body){margin:0;background:#f7f8fc;color:#1a2440;font-family:Inter,system-ui,sans-serif}:global(a){color:#3655b3}:global(button){background:#3655b3;color:white;border:0;border-radius:7px;padding:10px 16px;cursor:pointer}:global(h1){font-size:38px;letter-spacing:-1.2px;margin:12px 0}:global(h2){font-size:22px}:global(p){line-height:1.65}:global(code){background:#eff1f9;padding:3px 6px;border-radius:4px}:global(pre){background:#16213d;color:#e4eaff;padding:20px;border-radius:12px;overflow:auto}:global(.card){background:white;border:1px solid #e0e5f0;border-radius:14px;padding:24px;margin-top:20px}:global(table){width:100%;border-collapse:collapse}:global(th),:global(td){padding:12px;text-align:left;border-bottom:1px solid #e9edf5}:global(.on){color:#117051;font-weight:700}:global(.off){color:#956122;font-weight:700}:global(.eyebrow){font-size:11px;letter-spacing:1.4px;font-weight:700;color:#737f9d}.shell{display:flex;min-height:100vh}aside{width:215px;padding:34px 24px;background:#fff;border-right:1px solid #e2e7f2;flex-shrink:0}.brand{font-size:25px;font-weight:800;text-decoration:none}.brand span{font-size:13px;font-weight:500;color:#737f9d}nav{display:grid;gap:9px;margin-top:24px}nav a{padding:10px 12px;text-decoration:none;border-radius:6px;background:#f6f8fc}.footnote{font-size:12px;color:#737f9d;margin-top:50px}main{padding:30px 48px;max-width:1000px;flex:1}.banner{background:#fff2d7;border:1px solid #f0d594;color:#704f16;border-radius:8px;padding:12px 18px;font-size:13px;margin-bottom:30px}@media(max-width:750px){.shell{display:block}aside{width:auto;padding:20px}nav{display:flex;flex-wrap:wrap}.footnote{display:none}main{padding:24px}}
</style>
