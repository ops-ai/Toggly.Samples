import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import vue from '@astrojs/vue';
import toggly from '@ops-ai/astro-feature-flags-toggly/integration';
import { createTogglyOptions } from './src/toggly-config';

// Live E2E and `npm start` use the Node adapter SSR build so ?preset= and harness
// headers evaluate per request. Set SAMPLE_OUTPUT=static for the teaching SSG build.
const server = process.env.SAMPLE_OUTPUT !== 'static';

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
        true,
        process.env.TOGGLY_DEFINITIONS_BASE_URI,
        process.env.TOGGLY_METRICS_BASE_URL,
      ),
      // Only the injected browser store owns frontend telemetry. The server
      // options above keep trusted request/build usage reporting disabled.
      browserEnableUsageTracking: Boolean(process.env.TOGGLY_APP_KEY),
      browserEnableMetrics: Boolean(process.env.TOGGLY_APP_KEY),
      enableTelemetry: process.env.TOGGLY_BROWSER_TELEMETRY !== 'false',
      // SSG builds evaluate Feature.astro through middleware + defaults. Enabling
      // all features at build time is for edge-worker strip workflows; keep it
      // off for SSR so request evaluation stays honest.
      allFeaturesEnabledDuringBuild: !server,
    }),
  ],
});
