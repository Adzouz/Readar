import { describe, expect, it, vi } from 'vitest'
import type { SourceHealthRow } from '@/lib/database'

type Answer = { data: SourceHealthRow[] | boolean | null; error: { message: string } | null }

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn<(name: string) => Promise<Answer>>() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }))

const { healthKey, loadSourceHealth, useSourceHealth } = await import('./sourceHealth')

const row = (items: number): SourceHealthRow => ({
  topic_id: 'ai',
  slug: 'example-feed',
  url: null,
  fetched_at: '2026-11-09T11:00:00Z',
  last_status: 200,
  last_error: null,
  error_count: 0,
  items,
  latest_item_at: null,
})

describe('loadSourceHealth', () => {
  it('ignores an older call that answers after a newer one', async () => {
    let answerOld: (answer: Answer) => void = () => {}
    rpc.mockReturnValueOnce(new Promise((resolve) => (answerOld = resolve))) // old: health
    rpc.mockResolvedValueOnce({ data: false, error: null }) // old: worker_active
    rpc.mockResolvedValueOnce({ data: [row(12)], error: null }) // new: health
    rpc.mockResolvedValueOnce({ data: true, error: null }) // new: worker_active

    const old = loadSourceHealth()
    await loadSourceHealth()
    answerOld({ data: [row(0)], error: null })
    await old

    const state = useSourceHealth.getState()
    expect(state.rows[healthKey('ai', 'example-feed')]?.items).toBe(12)
    expect(state.workerActive).toBe(true)
    expect(state.loaded).toBe(true)
  })
})
