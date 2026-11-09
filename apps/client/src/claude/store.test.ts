import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  check: vi.fn<(key: string) => Promise<string | null>>(),
  save: vi.fn<(key: string) => Promise<void>>(),
}))
vi.mock('./check', () => ({ checkClaudeKey: fake.check }))
vi.mock('./key', async (original) => ({
  ...(await original<typeof import('./key')>()),
  saveClaudeKey: fake.save,
}))

const { connectClaude, useClaude } = await import('./store')

const KEY = 'sk-ant-api03-example_key-1234'

describe('connectClaude', () => {
  beforeEach(() => {
    fake.check.mockReset()
    fake.save.mockReset()
    useClaude.setState({ status: 'none', hint: null })
  })

  it('refuses text that is not a Console key without calling Claude', async () => {
    expect(await connectClaude('hello')).toMatch(/start with sk-ant-/)
    expect(fake.check).not.toHaveBeenCalled()
    expect(fake.save).not.toHaveBeenCalled()
  })

  it('saves nothing when Claude rejects the key', async () => {
    fake.check.mockResolvedValue("Claude didn't accept this key.")
    expect(await connectClaude(KEY)).toMatch(/didn't accept/)
    expect(fake.save).not.toHaveBeenCalled()
    expect(useClaude.getState().status).toBe('none')
  })

  it('saves a checked key and keeps only its last four characters in memory', async () => {
    fake.check.mockResolvedValue(null)
    expect(await connectClaude(`  ${KEY}\n`)).toBeNull()
    expect(fake.save).toHaveBeenCalledWith(KEY)
    expect(useClaude.getState()).toEqual({ status: 'connected', hint: '1234' })
  })
})
