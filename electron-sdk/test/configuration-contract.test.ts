import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const source = (relativePath: string) =>
  readFile(new URL(`../src/${relativePath}`, import.meta.url), 'utf8')

describe('sample configuration boundary', () => {
  it('keeps the legacy placeholder in offline defaults mode', async () => {
    await expect(source('main/index.ts')).resolves.toContain(
      "Boolean(appKey && appKey !== 'ci-placeholder')",
    )
    await expect(source('preload/index.ts')).resolves.toContain(
      "process.env.TOGGLY_APP_KEY !== 'ci-placeholder'",
    )
  })
})
