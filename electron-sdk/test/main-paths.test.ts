import { describe, expect, it } from 'vitest'
import { preloadEntryPath, rendererEntryPath } from '../src/main/paths'

describe('Electron build paths', () => {
  it('uses the compiled CommonJS preload emitted by electron-vite', () => {
    expect(preloadEntryPath('/app/out/main')).toBe('/app/out/preload/index.cjs')
  })

  it('uses the compiled renderer document emitted by electron-vite', () => {
    expect(rendererEntryPath('/app/out/main')).toBe('/app/out/renderer/index.html')
  })
})
