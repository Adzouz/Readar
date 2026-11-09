// Summaries on demand (PLAN.md §6): the Summarize button and the A key on one card, and the
// optional "Summarize ahead" for the next few cards of a topic. Each summary is paid by the
// user's own key, so nothing is summarized unless they ask, or switch "Summarize ahead" on.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SUMMARY_MODEL, SUMMARY_PROMPT_VERSION } from '@readar/core'
import type { CardSummary } from '@/deck/summary'
import { deckStore } from '@/deck/store'
import { supabase } from '@/lib/supabase'
import { rememberSummary } from '@/sync/summaries'
import { readClaudeKey } from './key'

/** Cards "Summarize ahead" prepares beyond the one on top of the deck. */
export const AHEAD = 5

interface SummaryState {
  /** Cards being summarized right now. */
  pending: Record<string, true>
  /** Why a card's last summary failed. */
  failed: Record<string, string>
  /** Set by key or credit trouble: "Summarize ahead" stops until the user fixes it. */
  paused: string | null
}

export const useSummaries = create<SummaryState>()(() => ({
  pending: {},
  failed: {},
  paused: null,
}))

interface AheadSetting {
  ahead: boolean
  setAhead: (ahead: boolean) => void
}

/** "Summarize ahead", off by default. Kept on this device only. */
export const useSummarizeAhead = create<AheadSetting>()(
  persist((set) => ({ ahead: false, setAhead: (ahead) => set({ ahead }) }), {
    name: 'readar.summaries',
    partialize: ({ ahead }) => ({ ahead }),
  }),
)

export type SummarizeResult =
  { ok: true } | { ok: false; reason: 'no-key' | 'busy' | 'failed'; message?: string }

const setPending = (itemId: string, on: boolean): void =>
  useSummaries.setState((state) => {
    const pending = { ...state.pending }
    if (on) pending[itemId] = true
    else delete pending[itemId]
    return { pending }
  })

const fail = (itemId: string, message: string): SummarizeResult => {
  useSummaries.setState((state) => ({ failed: { ...state.failed, [itemId]: message } }))
  return { ok: false, reason: 'failed', message }
}

/** The text Claude reads for a card: the article from Supabase, or the sample card's own text. */
async function inputFor(itemId: string) {
  const item = deckStore.getState().items[itemId]
  if (!item) return null
  if (!supabase) return { title: item.title, url: item.url, source: item.source, text: item.tldr }
  const { data, error } = await supabase.rpc('summary_input', { p_item_id: itemId })
  if (error) throw new Error(error.message)
  const row = data?.[0]
  if (!row?.text?.trim()) return null
  return { title: row.title, url: row.url, source: row.source_name, text: row.text }
}

/** Saves the summary for the user's other devices. The card keeps it even when this fails. */
async function save(itemId: string, summary: CardSummary, contentType: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('summaries').upsert(
    {
      item_id: itemId,
      prompt_version: SUMMARY_PROMPT_VERSION,
      model: SUMMARY_MODEL,
      tldr: summary.tldr,
      points: summary.points,
      content_type: contentType as 'article' | 'video' | 'thread' | 'podcast',
      reading_minutes: summary.readingMinutes,
    },
    { onConflict: 'user_id,item_id,prompt_version' },
  )
  if (error) console.warn('Readar: summary not saved.', error.message)
}

/** Summarizes one card with the user's key. Safe to call twice: the second call is ignored. */
export async function summarize(itemId: string): Promise<SummarizeResult> {
  const item = deckStore.getState().items[itemId]
  if (!item || item.summarized) return { ok: true }
  if (useSummaries.getState().pending[itemId]) return { ok: false, reason: 'busy' }
  // Marked before the first await, so a double press can't pay for two calls.
  setPending(itemId, true)
  const key = await readClaudeKey().catch(() => null)
  if (!key) {
    setPending(itemId, false)
    return { ok: false, reason: 'no-key' }
  }
  useSummaries.setState((state) => {
    const failed = { ...state.failed }
    delete failed[itemId]
    return { failed }
  })
  const { summaryProblem, writeSummary } = await import('./summarize')
  try {
    const input = await inputFor(itemId)
    if (!input) return fail(itemId, 'The source gave no text to summarize. Open the original.')
    const written = await writeSummary(key, input)
    if (!written) return fail(itemId, 'Claude declined to summarize this one.')
    const summary: CardSummary = {
      tldr: written.tldr,
      points: written.points,
      readingMinutes: written.readingMinutes,
    }
    rememberSummary(itemId, summary)
    deckStore.getState().applySummary(itemId, summary)
    useSummaries.setState({ paused: null })
    await save(itemId, summary, written.contentType)
    return { ok: true }
  } catch (error) {
    const problem = summaryProblem(error)
    if (problem.blocking) useSummaries.setState({ paused: problem.message })
    return fail(itemId, problem.message)
  } finally {
    setPending(itemId, false)
  }
}

/**
 * "Summarize ahead": the next cards of a deck, one at a time. Skips cards already summarized,
 * in progress or failed, and stops on key or credit trouble.
 */
export async function summarizeAhead(itemIds: string[]): Promise<void> {
  if (!useSummarizeAhead.getState().ahead) return
  for (const itemId of itemIds.slice(0, AHEAD + 1)) {
    const { pending, failed, paused } = useSummaries.getState()
    if (paused || !useSummarizeAhead.getState().ahead) return
    const item = deckStore.getState().items[itemId]
    if (!item || item.summarized || pending[itemId] || failed[itemId]) continue
    const result = await summarize(itemId)
    if (!result.ok && result.reason === 'no-key') return
  }
}
