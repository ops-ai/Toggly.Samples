/**
 * Memoize main-process setup so activating macOS after the last window closes
 * creates a new window without registering Electron IPC handlers a second time.
 */
export function createOneTimeSetup(setup: () => Promise<void>): () => Promise<void> {
  let setupPromise: Promise<void> | undefined

  return () => {
    if (!setupPromise) {
      setupPromise = setup().catch(error => {
        // A failed initial startup may be retried by the host; a successful one
        // remains shared for the complete Electron main-process lifetime.
        setupPromise = undefined
        throw error
      })
    }
    return setupPromise
  }
}
