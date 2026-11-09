import type { Item } from './types'

/** What a card shows from Claude's summary. */
export interface CardSummary {
  tldr: string
  points: string[]
  readingMinutes: number | null
}

/** The card with Claude's summary in place of the feed excerpt (shows the AI badge). */
export function withSummary(item: Item, summary: CardSummary): Item {
  const minutes = summary.readingMinutes
  const length =
    item.length || !minutes
      ? item.length
      : item.type === 'article' || item.type === 'thread'
        ? `${minutes} min read`
        : `${minutes} min`
  return { ...item, tldr: summary.tldr, points: summary.points, summarized: true, length }
}
