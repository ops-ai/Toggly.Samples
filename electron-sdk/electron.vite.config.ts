import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Main keeps Electron-only dependencies external. The preload is a standalone
// bundle: Electron's sandboxed loader cannot resolve the SDK from node_modules.
export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: {
        external: ['electron'],
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: { plugins: [react()] },
})
