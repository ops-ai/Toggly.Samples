import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter(),
      // adapter-node no longer reads ORIGIN; allow Playwright hosts used in test:browser.
      csrf: {
        trustedOrigins: ['http://127.0.0.1:4183', 'http://127.0.0.1:4184', 'http://127.0.0.1:4185'],
      },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'] },
});
