import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { SAMPLE_ITEMS } from '@/data/sample'
import {
  LIST_FOR_ACTION,
  type Action,
  type Item,
  type ListId,
  type Topic,
  type View,
} from './types'

export interface DeckData {
  topics: Topic[]
  items: Item[]
}

export interface DeckState {
  topics: Topic[]
  items: Record<string, Item>
  /** Item ids still to review, per topic, top card first. */
  queues: Record<string, string[]>
  /** Items each topic has in total (reviewed or not), for progress. */
  totals: Record<string, number>
  lists: Record<ListId, string[]>
  history: { action: Action; itemId: string }[]
  view: View
  /** Whether the top card shows its full summary. */
  expanded: boolean
  /** Moves the top card of the current topic to a list. Returns the item, if any. */
  decide: (action: Action) => Item | undefined
  /** Puts the last decided card back on top of its topic. Returns the item, if any. */
  undo: () => Item | undefined
  restore: (itemId: string) => void
  markRead: (itemId: string) => void
  select: (view: View) => void
  toggleExpanded: () => void
  /** Replaces the followed topics (after onboarding or an edit). Keeps lists and history. */
  load: (topics: Topic[]) => void
}

const NO_LISTS: Record<ListId, string[]> = { liked: [], later: [], dismissed: [] }

const removeLast = (list: string[], id: string): string[] => {
  const index = list.lastIndexOf(id)
  return index === -1 ? list : [...list.slice(0, index), ...list.slice(index + 1)]
}

const firstView = (topics: Topic[]): View => {
  const first = topics[0]
  return first ? { kind: 'topic', id: first.id } : { kind: 'list', id: 'liked' }
}

/** Queues and totals for a set of topics, leaving out cards already decided. */
function deal(topics: Topic[], items: Record<string, Item>, lists: Record<ListId, string[]>) {
  const decided = new Set([...lists.liked, ...lists.later, ...lists.dismissed])
  const all = Object.values(items)
  const queues: Record<string, string[]> = {}
  const totals: Record<string, number> = {}
  for (const topic of topics) {
    const ofTopic = all.filter((item) => item.topicId === topic.id)
    queues[topic.id] = ofTopic.filter((item) => !decided.has(item.id)).map((item) => item.id)
    totals[topic.id] = ofTopic.length
  }
  return { queues, totals }
}

export function createDeckStore(data: DeckData) {
  const byId: Record<string, Item> = Object.fromEntries(data.items.map((item) => [item.id, item]))

  return createStore<DeckState>()((set, get) => ({
    topics: data.topics,
    items: byId,
    ...deal(data.topics, byId, NO_LISTS),
    lists: NO_LISTS,
    history: [],
    view: firstView(data.topics),
    expanded: false,

    decide: (action) => {
      const { view, queues, lists, history, items } = get()
      if (view.kind !== 'topic') return undefined
      const [itemId, ...rest] = queues[view.id] ?? []
      if (!itemId) return undefined
      const target = LIST_FOR_ACTION[action]
      set({
        queues: { ...queues, [view.id]: rest },
        lists: { ...lists, [target]: [...lists[target], itemId] },
        history: [...history, { action, itemId }],
        expanded: false,
      })
      return items[itemId]
    },

    undo: () => {
      const { history, lists, queues, items, topics, view } = get()
      const last = history.at(-1)
      const item = last && items[last.itemId]
      if (!last || !item) return undefined
      const target = LIST_FOR_ACTION[last.action]
      // A card from a topic the user stopped following leaves its list but has no deck to return to.
      const followed = topics.some((topic) => topic.id === item.topicId)
      set({
        history: history.slice(0, -1),
        lists: { ...lists, [target]: removeLast(lists[target], item.id) },
        queues: followed
          ? { ...queues, [item.topicId]: [item.id, ...(queues[item.topicId] ?? [])] }
          : queues,
        view: followed ? { kind: 'topic', id: item.topicId } : view,
        expanded: false,
      })
      return item
    },

    restore: (itemId) => {
      const { lists, queues, items, history, topics } = get()
      const item = items[itemId]
      if (!item || !lists.dismissed.includes(itemId)) return
      const followed = topics.some((topic) => topic.id === item.topicId)
      set({
        lists: { ...lists, dismissed: lists.dismissed.filter((id) => id !== itemId) },
        queues: followed
          ? { ...queues, [item.topicId]: [itemId, ...(queues[item.topicId] ?? [])] }
          : queues,
        history: history.filter((entry) => entry.itemId !== itemId),
      })
    },

    markRead: (itemId) => {
      const { lists, history } = get()
      if (!lists.later.includes(itemId)) return
      set({
        lists: { ...lists, later: lists.later.filter((id) => id !== itemId) },
        history: history.filter((entry) => entry.itemId !== itemId),
      })
    },

    select: (view) => set({ view, expanded: false }),
    toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),

    load: (topics) => {
      const { items, lists, view } = get()
      const keepView = view.kind === 'list' || topics.some((topic) => topic.id === view.id)
      set({
        topics,
        ...deal(topics, items, lists),
        view: keepView ? view : firstView(topics),
        expanded: false,
      })
    },
  }))
}

/**
 * The app's deck. Topics come from the user's setup (see onboarding/connectDeck); cards are
 * sample data until the fetch worker and Supabase are wired (Phase 1).
 */
export const deckStore = createDeckStore({ topics: [], items: SAMPLE_ITEMS })

export const useDeck = <T>(selector: (state: DeckState) => T): T => useStore(deckStore, selector)
