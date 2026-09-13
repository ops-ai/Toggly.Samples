import { describe, expect, it } from 'vitest'
import { createOneTimeSetup } from '../src/main/toggly-lifecycle'

describe('Toggly main-process lifecycle', () => {
  it('sets up the SDK and IPC handlers once when macOS reopens a window', async () => {
    let setupCalls = 0
    const ensureToggly = createOneTimeSetup(async () => { setupCalls += 1 })

    await ensureToggly()
    await ensureToggly()

    expect(setupCalls).toBe(1)
  })

  it('shares an in-flight setup promise instead of registering handlers twice', async () => {
    let release!: () => void
    let setupCalls = 0
    const ensureToggly = createOneTimeSetup(async () => {
      setupCalls += 1
      await new Promise<void>(resolve => { release = resolve })
    })

    const first = ensureToggly()
    const second = ensureToggly()
    release()
    await Promise.all([first, second])

    expect(setupCalls).toBe(1)
  })
})
