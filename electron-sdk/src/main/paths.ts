import { join } from 'node:path'

// Electron's sandboxed preload loader uses this compiled CommonJS bundle.
// Keeping this path tested prevents a build-only mismatch from surfacing as a
// blank desktop window at runtime.
export const preloadEntryPath = (mainDirectory: string): string =>
  join(mainDirectory, '../preload/index.cjs')

export const rendererEntryPath = (mainDirectory: string): string =>
  join(mainDirectory, '../renderer/index.html')
