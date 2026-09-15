import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import vue from '@astrojs/vue';
import toggly from '@ops-ai/astro-feature-flags-toggly/integration';
import { createTogglyOptions } from './src/toggly-config';

// Static SSG is the default teaching build. Set SAMPLE_OUTPUT=server for the
// Node adapter SSR build used by middleware/page-gate tests.
const server = process.env.SAMPLE_OUTPUT === 'server';

export default defineConfig({
  output: server ? 'server' : 'static',
  adapter: server ? node({ mode: 'standalone' }) : undefined,
  integrations: [
    react(),
    vue(),
    svelte(),
    // Integration options are baked into window.__TOGGLY_CONFIG__ for islands.
    // Do not put request identity here — that belongs on the middleware client.
    toggly({
      ...createTogglyOptions(
        process.env.TOGGLY_APP_KEY,
        process.env.TOGGLY_ENVIRONMENT ?? 'Production',
      ),
      // SSG builds evaluate Feature.astro through middleware + defaults. Enabling
      // all features at build time is for edge-worker strip workflows; keep it
      // off for SSR so request evaluation stays honest.
      allFeaturesEnabledDuringBuild: !server,
    }),
  ],
});
