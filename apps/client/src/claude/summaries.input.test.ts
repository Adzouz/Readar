import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_ITEMS } from '@/data/sample'

const fake = vi.hoisted(() => ({
  rpc: vi.fn<() => Promise<{ data: null; error: { message: string } }>>(),
  write: vi.fn<() => Promise<unknown>>(),
}))
// With Supabase: the article text comes from the summary_input call.
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: fake.rpc } }))
vi.mock('./key', () => ({ readClaudeKey: async () => 'sk-ant-api03-example' }))
vi.mock('./summarize', async (original) => ({
  ...(await original<typeof import('./summarize')>()),
  writeSummary: fake.write,
}))

const { deckStore } = await import('@/deck/store')
const { summarize, summarizeAhead, useSummaries, useSummarizeAhead } = await import('./summaries')
const ids = SAMPLE_ITEMS.map((item) => item.id)

beforeEach(() => {
  deckStore.getState().setContent(SAMPLE_ITEMS, { liked: [], later: [], dismissed: [] })
  useSummaries.setState({ pending: {}, failed: {}, paused: null })
  fake.rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
})

describe('loading the article fails (offline)', () => {
  it('is worth trying again: no Claude call, no lasting skip', async () => {
    expect(await summarize(ids[0]!)).toMatchObject({ ok: false, transient: true })
    expect(fake.write).not.toHaveBeenCalled()
    expect(useSummaries.getState()).toMatchObject({ failed: {}, pending: {} })
  })

  it('stops "Summarize ahead" at the first card', async () => {
    useSummarizeAhead.setState({ ahead: true })
    await summarizeAhead(ids)
    expect(fake.rpc).toHaveBeenCalledOnce()
  })
})
