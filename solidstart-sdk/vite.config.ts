import { defineConfig } from 'vite';
import { solidStart } from '@solidjs/start/config';
import { nitro } from 'nitro/vite';
export default defineConfig({
  plugins: [solidStart(), nitro()],
  optimizeDeps: {
    // The development toolbar's trace-mapping import selects resolve-uri's UMD
    // browser entry. Prebundle that boundary so it supplies the ESM default export.
    include: ['@jridgewell/resolve-uri'],
  },
});
