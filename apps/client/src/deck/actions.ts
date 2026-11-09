import { useMemo, type RefObject } from 'react'
import { openExternal, shareLink } from '@/lib/platform'
import { summarize } from '@/claude/summaries'
import { useToast } from '@/shell/toast'
import type { DeckHandle } from './Deck'
import { deckStore } from './store'
import type { Action, Item } from './types'

export interface DeckActions {
  act: (action: Action) => void
  undo: () => void
  open: () => void
  share: () => void
  /** Claude summary of the top card; on a summarized card, shows its key points. */
  summarize: () => void
}

/** The top card of the topic on screen, if any. */
export function currentItem(): Item | undefined {
  const { view, queues, items } = deckStore.getState()
  if (view.kind !== 'topic') return undefined
  const id = queues[view.id]?.[0]
  return id ? items[id] : undefined
}

/** Summarizes a card and says why when it can't. Shared by the deck and the lists. */
export async function summarizeItem(item: Item, show: (message: string) => void): Promise<void> {
  if (item.summarized) {
    if (currentItem()?.id === item.id && !deckStore.getState().expanded) {
      deckStore.getState().toggleExpanded()
    }
    return
  }
  const result = await summarize(item.id)
  if (result.ok) {
    // Open the key points of the card still on top, once its summary arrives.
    if (currentItem()?.id === item.id && !deckStore.getState().expanded) {
      deckStore.getState().toggleExpanded()
    }
  } else if (result.reason === 'no-key') {
    show('Connect Claude in Settings to summarize cards')
  } else if (result.message) {
    show(result.message)
  }
}

export async function shareItem(item: Item, show: (message: string) => void): Promise<void> {
  const result = await shareLink(item.title, item.url)
  if (result === 'copied') show('Link copied')
  else if (result === 'failed') show('Could not share this link')
}

/** Deck commands shared by the keyboard, the action bar and gestures. */
export function useDeckActions(deckRef: RefObject<DeckHandle | null>): DeckActions {
  const show = useToast((s) => s.show)
  return useMemo(
    () => ({
      act: (action) => deckRef.current?.fling(action),
      undo: () => show(deckStore.getState().undo() ? 'Back on top of the deck' : 'Nothing to undo'),
      open: () => {
        const item = currentItem()
        if (item) void openExternal(item.url)
      },
      share: () => {
        const item = currentItem()
        if (item) void shareItem(item, show)
      },
      summarize: () => {
        const item = currentItem()
        if (item) void summarizeItem(item, show)
      },
    }),
    [deckRef, show],
  )
}
