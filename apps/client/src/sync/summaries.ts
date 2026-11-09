// Summaries already written for the cards on screen. They are saved privately in Supabase (one
// row per user, item and prompt version) and remembered here, so a reload that races a summary
// never puts the feed excerpt back.
import { SUMMARY_PROMPT_VERSION } from '@readar/core'
import { withSummary, type CardSummary } from '@/deck/summary'
import type { Item } from '@/deck/types'
import type { SummaryRow } from '@/lib/database'
import { supabase } from '@/lib/supabase'

const known = new Map<string, CardSummary>()

/** Supabase caps URL length: ask for summaries in batches of ids. */
const BATCH = 100

export const rememberSummary = (itemId: string, summary: CardSummary): void => {
  known.set(itemId, summary)
}

export const forgetSummaries = (): void => known.clear()

export const summaryOf = (row: Pick<SummaryRow, 'tldr' | 'points' | 'reading_minutes'>) => ({
  tldr: row.tldr,
  points: row.points,
  readingMinutes: row.reading_minutes,
})

/** The cards with every summary known on this device in place of their excerpts. */
export function withKnownSummaries(items: Item[]): Item[] {
  return items.map((item) => {
    const summary = known.get(item.id)
    return summary ? withSummary(item, summary) : item
  })
}

/** Loads the saved summaries of these cards. Keeps what is known when it fails (offline). */
export async function fetchSummaries(itemIds: string[]): Promise<void> {
  if (!supabase || !itemIds.length) return
  for (let start = 0; start < itemIds.length; start += BATCH) {
    const { data, error } = await supabase
      .from('summaries')
      .select('item_id, tldr, points, reading_minutes')
      .eq('prompt_version', SUMMARY_PROMPT_VERSION)
      .in('item_id', itemIds.slice(start, start + BATCH))
    if (error) {
      console.warn('Readar: summaries not loaded.', error.message)
      return
    }
    for (const row of data) known.set(row.item_id, summaryOf(row))
  }
}
