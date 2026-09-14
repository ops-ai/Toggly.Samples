import { build } from 'esbuild';
await build({
  entryPoints: ['browser.mjs'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  conditions: ['browser'],
  outfile: 'dist/browser.js',
  logLevel: 'silent',
});
