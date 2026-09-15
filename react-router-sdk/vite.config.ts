import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'

// Framework-mode Vite plugin. Server loaders stay on the server; only
// VITE_* values are inlined into the browser bundle.
export default defineConfig({
  plugins: [reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
})
