// Cards and lists from Supabase, cached on the device, plus the outbox that sends each swipe.

import type { ItemState } from '@readar/core'
import { deckStore, setDeckEffects } from '@/deck/store'
import { LIST_FOR_ACTION, type Item, type ListId, type Topic } from '@/deck/types'
import { supabase } from '@/lib/supabase'
import { toItem } from './items'

const CACHE_KEY = 'readar.deck'
const OUTBOX_KEY = 'readar.outbox'
const DECK_LIMIT = 30
const FLUSH_DELAY_MS = 400

const isUuid = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

const read = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

const write = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: the app still works, it just reloads from Supabase next time.
  }
}

// --- Outbox: decisions waiting to reach Supabase ---------------------------------------------

/** Latest decision per item. `state: null` sends the item back to its deck. */
export type Outbox = Record<string, { topicId: string; state: ItemState | null; at: string }>

const LIST_OF_STATE: Partial<Record<ItemState, ListId>> = {
  liked: 'liked',
  later: 'later',
  dismissed: 'dismissed',
}

/**
 * Lists from the server with the decisions not sent yet applied on top. A swipe made while a
 * reload was in flight is missing from the server copy and must not come back.
 */
export function applyPending(
  lists: Record<ListId, string[]>,
  pending: Outbox,
): Record<ListId, string[]> {
  const ids = Object.keys(pending)
  if (!ids.length) return lists
  const touched = new Set(ids)
  const next: Record<ListId, string[]> = {
    liked: lists.liked.filter((id) => !touched.has(id)),
    later: lists.later.filter((id) => !touched.has(id)),
    dismissed: lists.dismissed.filter((id) => !touched.has(id)),
  }
  for (const [id, entry] of Object.entries(pending)) {
    const listId = entry.state ? LIST_OF_STATE[entry.state] : undefined
    if (listId) next[listId].push(id)
  }
  return next
}

let outbox: Outbox = read<Outbox>(OUTBOX_KEY) ?? {}
let flushTimer: ReturnType<typeof setTimeout> | undefined
let flushing: Promise<boolean> | null = null

function enqueue(item: Item, state: ItemState | null): void {
  if (!supabase || !isUuid(item.id)) return
  outbox = { ...outbox, [item.id]: { topicId: item.topicId, state, at: new Date().toISOString() } }
  write(OUTBOX_KEY, outbox)
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void flushOutbox(), FLUSH_DELAY_MS)
}

async function sendOutbox(): Promise<boolean> {
  if (!supabase) return true
  const batch = outbox
  const entries = Object.entries(batch)
  if (!entries.length) return true
  const upserts = entries.flatMap(([itemId, entry]) =>
    entry.state
      ? [{ item_id: itemId, topic_id: entry.topicId, state: entry.state, decided_at: entry.at }]
      : [],
  )
  const deletes = entries.filter(([, entry]) => !entry.state).map(([itemId]) => itemId)
  if (upserts.length) {
    const { error } = await supabase
      .from('user_items')
      .upsert(upserts, { onConflict: 'user_id,item_id' })
    if (error) {
      console.warn('Readar: swipes not saved yet, will retry.', error.message)
      return false
    }
  }
  if (deletes.length) {
    const { error } = await supabase.from('user_items').delete().in('item_id', deletes)
    if (error) {
      console.warn('Readar: undo not saved yet, will retry.', error.message)
      return false
    }
  }
  // Keep entries that changed while the request was in flight.
  const rest: Outbox = {}
  for (const [itemId, entry] of Object.entries(outbox)) {
    if (batch[itemId] !== entry) rest[itemId] = entry
  }
  outbox = rest
  write(OUTBOX_KEY, outbox)
  return true
}

/** Sends pending decisions. Resolves true when nothing is left to send. */
export function flushOutbox(): Promise<boolean> {
  clearTimeout(flushTimer)
  flushing ??= sendOutbox().finally(() => {
    flushing = null
  })
  return flushing
}

/** Queues every card in the local lists, to carry them into a newly signed-in account. */
export function enqueueLists(): void {
  const { lists, items } = deckStore.getState()
  for (const listId of Object.keys(lists) as ListId[]) {
    for (const id of lists[listId]) {
      const item = items[id]
      if (item) enqueue(item, listId)
    }
  }
}

export function connectDeckEffects(): void {
  setDeckEffects({
    decided: (item, action) => enqueue(item, LIST_FOR_ACTION[action]),
    reverted: (item) => enqueue(item, null),
    read: (item) => enqueue(item, 'read'),
  })
}

// --- Cards and lists --------------------------------------------------------------------------

interface Cache {
  items: Item[]
  lists: Record<ListId, string[]>
}

/** Shows the cards from the last session right away, before Supabase answers. */
export function restoreCachedContent(): void {
  const cache = read<Cache>(CACHE_KEY)
  if (cache?.items && cache.lists) deckStore.getState().setContent(cache.items, cache.lists)
}

let generation = 0
let lastLoad = 0

/** Milliseconds since the last successful load. */
export const sinceLastLoad = (): number => Date.now() - lastLoad

/**
 * Reloads every followed topic's deck and the lists. Pending decisions are sent first, so cards
 * already swiped don't come back. Keeps the current cards when offline.
 */
export async function loadContent(): Promise<void> {
  const client = supabase
  if (!client) return
  const run = ++generation
  if (!(await flushOutbox())) return

  const topics: Topic[] = deckStore.getState().topics
  const now = Date.now()
  const decks = await Promise.all(
    topics.map(async (topic) => {
      const { data, error } = await client.rpc('deck', {
        p_topic_id: topic.id,
        p_limit: DECK_LIMIT,
      })
      if (error) throw error
      return (data ?? []).flatMap((row) => toItem(row, topic, now) ?? [])
    }),
  )
  const { data: listed, error } = await client.rpc('list_items')
  if (error) throw error
  if (run !== generation) return

  const names = new Map(topics.map((topic) => [topic.id, topic.name]))
  const items = decks.flat()
  const server: Record<ListId, string[]> = { liked: [], later: [], dismissed: [] }
  for (const row of listed ?? []) {
    const listId = LIST_OF_STATE[row.state]
    if (!listId) continue
    // A card shown in a list but also in a deck (another device decided it) belongs to the list.
    const name = names.get(row.topic_id) ?? row.topic_id
    const item = toItem(row, { id: row.topic_id, name }, now)
    if (!item) continue
    items.push(item)
    server[listId].push(row.id)
  }
  const unique = [...new Map(items.map((item) => [item.id, item])).values()]
  const known = new Set(unique.map((item) => item.id))
  // Swipes made while this load was in flight win over the server copy.
  const lists = applyPending(
    server,
    Object.fromEntries(Object.entries(outbox).filter(([id]) => known.has(id))),
  )
  deckStore.getState().setContent(unique, lists)
  write(CACHE_KEY, { items: unique, lists } satisfies Cache)
  lastLoad = Date.now()
}

/** Removes everything this module keeps on the device (used on sign-out). */
export function clearLocalContent(): void {
  outbox = {}
  for (const key of [CACHE_KEY, OUTBOX_KEY]) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Ignore: the page reloads next.
    }
  }
}
