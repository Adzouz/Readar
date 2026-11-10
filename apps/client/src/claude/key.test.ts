import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetClaudeKey, isClaudeKeyShape, readClaudeKey, saveClaudeKey } from './key'

describe('isClaudeKeyShape', () => {
  it('accepts Console keys only', () => {
    expect(isClaudeKeyShape('sk-ant-api03-abc_DEF-123')).toBe(true)
    expect(isClaudeKeyShape('sk-proj-abc')).toBe(false)
    expect(isClaudeKeyShape('sk-ant-api03 abc')).toBe(false)
    expect(isClaudeKeyShape(`sk-ant-${'a'.repeat(300)}`)).toBe(false)
  })
})

describe('web key storage', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('saves a trimmed key, reads it back and forgets it', async () => {
    await saveClaudeKey('  sk-ant-api03-abc  ')
    expect(await readClaudeKey()).toBe('sk-ant-api03-abc')
    await forgetClaudeKey()
    expect(await readClaudeKey()).toBeNull()
  })

  it('refuses a key that is not shaped like a Console key', async () => {
    await expect(saveClaudeKey('sk-proj-abc')).rejects.toThrow("doesn't look like")
    expect(await readClaudeKey()).toBeNull()
  })
})
