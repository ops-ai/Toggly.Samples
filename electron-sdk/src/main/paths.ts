import { join } from 'node:path'

// electron-vite writes an ESM preload bundle when this package is ESM. Keeping
// these paths tested prevents an otherwise build-only mismatch from surfacing
// as a blank desktop window at runtime.
export const preloadEntryPath = (mainDirectory: string): string =>
  join(mainDirectory, '../preload/index.mjs')

export const rendererEntryPath = (mainDirectory: string): string =>
  join(mainDirectory, '../renderer/index.html')
