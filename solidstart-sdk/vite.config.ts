import { defineConfig } from 'vite';
import { solidStart } from '@solidjs/start/config';
import { nitro } from 'nitro/vite';
export default defineConfig({
  plugins: [solidStart(), nitro()],
  server: {
    // Discover the initial client routes before their HMR update can interrupt
    // first-page hydration and leave the toolbar and user effects queued.
    warmup: { clientFiles: ['./src/app.tsx'] },
  },
  optimizeDeps: {
    // The development toolbar's trace-mapping import selects resolve-uri's UMD
    // browser entry. Prebundle that boundary so it supplies the ESM default export.
    include: ['@jridgewell/resolve-uri'],
  },
});
