import { describe, expect, it } from 'vitest'
import { preloadEntryPath, rendererEntryPath } from '../src/main/paths'

describe('Electron build paths', () => {
  it('uses the ESM preload file emitted by electron-vite', () => {
    expect(preloadEntryPath('/app/out/main')).toBe('/app/out/preload/index.mjs')
  })

  it('uses the renderer HTML emitted beside the main bundle', () => {
    expect(rendererEntryPath('/app/out/main')).toBe('/app/out/renderer/index.html')
  })
})
