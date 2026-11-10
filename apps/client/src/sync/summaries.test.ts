import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_ITEMS } from '@/data/sample'

type Answer = {
  data: { item_id: string; tldr: string; points: string[]; reading_minutes: number | null }[] | null
  error: { message: string } | null
}

const fake = vi.hoisted(() => ({ in: vi.fn<(column: string, ids: string[]) => Promise<Answer>>() }))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ in: fake.in }) }) }) },
}))

const { fetchSummaries, forgetSummaries, rememberSummary, withKnownSummaries } =
  await import('./summaries')

const row = (id: string) => ({
  item_id: id,
  tldr: `TL;DR ${id}`,
  points: ['p'],
  reading_minutes: 3,
})
const card = SAMPLE_ITEMS[0]!

beforeEach(() => {
  forgetSummaries()
  fake.in.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('fetchSummaries', () => {
  it('asks in batches of 100 ids', async () => {
    fake.in.mockImplementation(async (_column, ids) => ({ data: ids.map(row), error: null }))
    const ids = Array.from({ length: 250 }, (_, index) => `id-${index}`)
    await fetchSummaries(ids)
    expect(fake.in.mock.calls.map(([, batch]) => batch.length)).toEqual([100, 100, 50])
    const [item] = withKnownSummaries([{ ...card, id: 'id-249' }])
    expect(item?.summary?.tldr).toBe('TL;DR id-249')
    expect(item?.excerpt).toBe(card.excerpt)
  })

  it('keeps a summary written on this device when loading fails', async () => {
    rememberSummary(card.id, { tldr: 'Mine', points: [], readingMinutes: null })
    fake.in.mockResolvedValue({ data: null, error: { message: 'offline' } })
    await fetchSummaries([card.id])
    expect(withKnownSummaries([card])[0]?.summary?.tldr).toBe('Mine')
  })
})

describe('forgetSummaries', () => {
  it('clears what is known (account switch, sign-out)', () => {
    rememberSummary(card.id, { tldr: 'Mine', points: [], readingMinutes: null })
    forgetSummaries()
    expect(withKnownSummaries([card])[0]?.summary).toBeUndefined()
  })
})
