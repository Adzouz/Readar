import { describe, expect, it, vi } from 'vitest'
import type { ItemCardRow, ListItemRow } from '@/lib/database'
import { deckStore } from '@/deck/store'
import { applyPending, connectDeckEffects, flushOutbox, loadContent, type Outbox } from './content'
import { toItem } from './items'

const fake = vi.hoisted(() => ({
  rpc: vi.fn<(name: string) => Promise<unknown>>(),
  upsert: vi.fn<() => Promise<{ error: null }>>(async () => ({ error: null })),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: fake.rpc,
    from: () => ({ upsert: fake.upsert, delete: () => ({ in: async () => ({ error: null }) }) }),
  },
}))

const at = '2026-11-06T12:00:00Z'

describe('applyPending', () => {
  const server = { liked: ['a'], later: ['b'], dismissed: ['c'] }

  it('keeps the server lists when nothing is pending', () => {
    expect(applyPending(server, {})).toBe(server)
  })

  it('applies swipes, undos and reads the server has not seen yet', () => {
    const pending: Outbox = {
      d: { topicId: 't', state: 'liked', at }, // swiped during the reload
      a: { topicId: 't', state: null, at }, // undone: back to its deck
      b: { topicId: 't', state: 'read', at }, // marked read: leaves Read later
      c: { topicId: 't', state: 'later', at }, // moved from Dismissed to Read later
    }
    expect(applyPending(server, pending)).toEqual({ liked: ['d'], later: ['c'], dismissed: [] })
  })
})

describe('loadContent', () => {
  const ID = '00000000-0000-4000-8000-000000000001'
  const row: ItemCardRow = {
    id: ID,
    url: 'https://www.example.com/post',
    title: 'Title',
    author: null,
    published_at: at,
    image_url: null,
    excerpt: 'Excerpt',
    content_type: 'article',
    reading_minutes: 4,
    source_name: 'Example',
    coverage: 3,
  }

  it('keeps a swipe sent while the reload was in flight', async () => {
    let answerLists: (rows: ListItemRow[]) => void = () => {}
    fake.rpc.mockImplementation(async (name: string) => {
      if (name === 'deck') return { data: [row], error: null }
      // The server reads the lists before the swipe below reaches it.
      return new Promise((resolve) => {
        answerLists = (rows) => resolve({ data: rows, error: null })
      })
    })
    const topic = { id: 'ai', name: 'AI', emoji: '🤖', hue: '#000000' }
    deckStore.getState().load([topic])
    deckStore.getState().setContent([toItem(row, topic)!], { liked: [], later: [], dismissed: [] })
    connectDeckEffects()

    const loading = loadContent()
    await vi.waitFor(() => expect(fake.rpc).toHaveBeenCalledWith('list_items'))
    // The user likes the card and the like is sent before the lists come back.
    expect(deckStore.getState().decide('like')?.id).toBe(ID)
    expect(await flushOutbox()).toBe(true)
    expect(fake.upsert).toHaveBeenCalledOnce()

    answerLists([])
    await loading

    const { lists, queues } = deckStore.getState()
    expect(lists.liked).toEqual([ID])
    expect(queues.ai).toEqual([])
  })
})
