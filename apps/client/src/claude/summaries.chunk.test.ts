import { describe, expect, it, vi } from 'vitest'
import { SAMPLE_ITEMS } from '@/data/sample'

vi.mock('@/lib/supabase', () => ({ supabase: null }))
vi.mock('./key', () => ({ readClaudeKey: async () => 'sk-ant-api03-example' }))
// The lazily loaded Claude code can't be fetched (web build, offline).
vi.mock('./summarize', () => {
  throw new Error('Failed to fetch dynamically imported module')
})

const { deckStore } = await import('@/deck/store')
const { summarize, useSummaries } = await import('./summaries')

describe('the Claude code fails to load', () => {
  it('clears pending and says it is worth trying again', async () => {
    deckStore.getState().setContent(SAMPLE_ITEMS, { liked: [], later: [], dismissed: [] })
    const id = SAMPLE_ITEMS[0]!.id
    expect(await summarize(id)).toMatchObject({ ok: false, transient: true })
    expect(useSummaries.getState()).toMatchObject({ pending: {}, failed: {} })
  })
})
