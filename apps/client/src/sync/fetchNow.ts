// "Fetch now" (PLAN.md §11): when the user adds sources and goes back to the deck, the app asks
// for a fetch. A running worker answers within seconds ("Fetching new articles…"); otherwise the
// hourly GitHub Actions run picks it up ("fetched within the hour"). Either way the cards reload
// once the pass is done.
import { create } from 'zustand'
import { deckStore } from '@/deck/store'
import { supabase } from '@/lib/supabase'
import { useSetup, type SetupState } from '@/onboarding/store'
import { useToast } from '@/shell/toast'
import { loadContent } from './content'
import { pushSetup } from './setup'
import { loadSourceHealth } from './sourceHealth'

export type FetchNowStatus = 'idle' | 'fetching' | 'scheduled'

export const useFetchNow = create<{ status: FetchNowStatus }>()(() => ({ status: 'idle' }))

type Picks = Pick<SetupState, 'topicIds' | 'keywords' | 'disabledSourceIds' | 'userSources'>

/** True when the new picks bring a source the old ones didn't have. Removals don't count. */
export function addsSources(before: Picks, after: Picks): boolean {
  const added = <T>(old: T[], next: T[]) => next.some((value) => !old.includes(value))
  return (
    added(before.topicIds, after.topicIds) ||
    added(
      before.keywords.map((k) => k.id),
      after.keywords.map((k) => k.id),
    ) ||
    added(
      before.userSources.map((s) => s.id),
      after.userSources.map((s) => s.id),
    ) ||
    // A suggested source switched back on.
    added(after.disabledSourceIds, before.disabledSourceIds)
  )
}

/** While a worker runs: it answers within seconds. */
export const POLL_MS = 4_000
/** Waiting for the hourly run: check now and then, quietly. */
export const SLOW_POLL_MS = 60_000
/** How long "fetched within the hour" stays on screen. */
export const NOTICE_MS = 8_000
/** The hourly run, plus GitHub's usual delay; past this, stop watching. */
export const GIVE_UP_MS = 75 * 60_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const later = (a: string, b: string) => Date.parse(a) >= Date.parse(b)

let latest = 0

/** Asks the worker for a pass now, then reloads the cards when it is done. */
export async function fetchNewArticles(): Promise<void> {
  if (!supabase) return
  const run = ++latest
  const set = (status: FetchNowStatus) => {
    if (run === latest) useFetchNow.setState({ status })
  }
  set('fetching')
  // The worker reads the saved setup: the new sources must be in Supabase first.
  if (!(await pushSetup())) return set('idle')
  const { data: requestedAt, error } = await supabase.rpc('request_fetch')
  if (error || !requestedAt) {
    console.warn('Readar: fetch not requested.', error?.message)
    set('idle')
    if (run === latest) {
      useToast
        .getState()
        .show("Couldn't fetch right away. New sources are fetched on the next round.")
    }
    return
  }
  const before = new Set(Object.keys(deckStore.getState().items))
  const started = Date.now()
  let wait = 0
  // First check right away: without a running worker, say so now rather than after a poll.
  while (Date.now() - started < GIVE_UP_MS) {
    if (wait) await sleep(wait)
    if (run !== latest) return // a newer request took over
    const { data } = await supabase.rpc('fetch_status')
    const row = data?.[0]
    if (row?.done_at && later(row.done_at, requestedAt)) {
      await loadContent()
      void loadSourceHealth()
      if (run !== latest) return
      const added = Object.keys(deckStore.getState().items).filter((id) => !before.has(id)).length
      set('idle')
      useToast
        .getState()
        .show(
          added
            ? `${added} new ${added === 1 ? 'article' : 'articles'}`
            : 'No new articles yet. Your sources may not have published lately.',
        )
      return
    }
    if (row?.worker_active) {
      set('fetching')
      wait = POLL_MS
    } else {
      // No worker right now: say when it will happen, then keep watching quietly.
      if (!wait) {
        set('scheduled')
        setTimeout(() => {
          if (useFetchNow.getState().status === 'scheduled') set('idle')
        }, NOTICE_MS)
      } else if (useFetchNow.getState().status === 'fetching') {
        set('idle')
      }
      wait = SLOW_POLL_MS
    }
  }
  set('idle')
}

/** Asks for a fetch when the user comes back to the deck with new sources. */
export function watchForNewSources(): () => void {
  let added = false
  return useSetup.subscribe((state, previous) => {
    if (addsSources(previous, state)) added = true
    if (added && state.step === 'done' && previous.step !== 'done') {
      added = false
      fetchNewArticles().catch((error: unknown) => {
        console.warn('Readar fetch now:', error)
        useFetchNow.setState({ status: 'idle' })
      })
    }
  })
}
