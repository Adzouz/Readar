// Whether each source the user reads actually brings articles, so the sources screen and the deck
// can flag the ones that don't (PLAN.md §11). The worker records the facts; this decides the state.
import { MAX_ENTRY_AGE_DAYS } from '@readar/core'
import { create } from 'zustand'
import type { SourceHealthRow } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { ageOf } from './items'

export type HealthState = 'waiting' | 'ok' | 'empty' | 'failing'

export interface SourceHealth {
  state: HealthState
  /** One line for the source row, e.g. "12 articles · latest 3h ago". */
  label: string
}

export const SYNCING: SourceHealth = { state: 'waiting', label: 'Syncing…' }
/** Readar fetches every hour (GitHub Actions); a running worker fetches sooner. */
export const NOT_FETCHED: SourceHealth = { state: 'waiting', label: 'Fetched within the hour' }

/** Turns a worker error into words people can act on. */
function problemOf(row: SourceHealthRow): string {
  const status = row.last_status ?? 0
  const error = row.last_error ?? ''
  if (/no feed found|not a feed/i.test(error)) return "Doesn't seem to be an article feed"
  if (/firewall/i.test(error)) return "Blocked by the site's firewall"
  if (/private address|not a web address/i.test(error)) return 'Not a public website'
  if (status === 404 || status === 410) return 'Page not found'
  if (status === 401 || status === 403) return 'The site blocks Readar'
  if (status === 429) return 'The site is limiting requests'
  if (status >= 500) return 'The site is having trouble'
  if (/timeout|aborted/i.test(error)) return 'The site takes too long to answer'
  return "Couldn't reach the site"
}

const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Why a feed that works brings nothing. */
function emptyLabel(row: SourceHealthRow, now: number): string {
  if (row.feed_entries === 0) return 'The feed has no articles'
  const newest = row.newest_entry_at
  if (newest && now - Date.parse(newest) > MAX_ENTRY_AGE_DAYS * 86_400_000) {
    return `Articles too old · latest ${monthYear(newest)}`
  }
  return 'No recent articles found'
}

/**
 * The state of one source. One failed fetch can be a passing hiccup, so a source that already
 * brought articles counts as failing only after two failures in a row. A source not fetched yet
 * shows "Syncing…" only while a worker is running; otherwise nothing is on its way.
 */
export function healthOf(
  row: SourceHealthRow | undefined,
  workerActive: boolean,
  now = Date.now(),
): SourceHealth {
  if (!row || !row.fetched_at) {
    if (row && row.error_count > 0) return { state: 'failing', label: problemOf(row) }
    return workerActive ? SYNCING : NOT_FETCHED
  }
  const failing = row.error_count >= 2 || (row.error_count >= 1 && row.items === 0)
  if (failing) return { state: 'failing', label: problemOf(row) }
  if (row.items === 0) return { state: 'empty', label: emptyLabel(row, now) }
  const age = ageOf(row.latest_item_at, now)
  const latest = !age
    ? ''
    : age === 'now'
      ? ' · latest just now'
      : / /.test(age)
        ? ` · latest ${age}`
        : ` · latest ${age} ago`
  return {
    state: 'ok',
    label: `${row.items} ${row.items === 1 ? 'article' : 'articles'}${latest}`,
  }
}

/** Key for a source in a topic: catalog and keyword sources by id (slug), links by URL. */
export const healthKey = (topicId: string, sourceIdOrUrl: string): string =>
  `${topicId} ${sourceIdOrUrl}`

interface HealthStore {
  rows: Record<string, SourceHealthRow>
  /** A worker beat in the last few minutes: sources waiting for a fetch will get one soon. */
  workerActive: boolean
  /** False until the first answer: rows show no status rather than a wrong one. */
  loaded: boolean
}

export const useSourceHealth = create<HealthStore>()(() => ({
  rows: {},
  workerActive: false,
  loaded: false,
}))

let latest = 0

/** Reloads the facts. Keeps the last known ones when offline or without Supabase. */
export async function loadSourceHealth(): Promise<void> {
  if (!supabase) return
  const run = ++latest
  const [{ data, error }, worker] = await Promise.all([
    supabase.rpc('my_source_health'),
    supabase.rpc('worker_active'),
  ])
  // An older call that answers late must not overwrite a newer answer.
  if (run !== latest) return
  if (error) {
    console.warn('Readar: source health not loaded.', error.message)
    return
  }
  const rows: Record<string, SourceHealthRow> = {}
  for (const row of data ?? []) {
    const id = row.slug ?? row.url
    if (id) rows[healthKey(row.topic_id, id)] = row
  }
  useSourceHealth.setState({ rows, workerActive: worker.data === true, loaded: true })
}

/** How many of a topic's active sources (catalog ids or link URLs) are failing or bring nothing. */
export function troubledCount(
  rows: Record<string, SourceHealthRow>,
  topicId: string,
  activeIds: string[],
  now = Date.now(),
): number {
  return activeIds.filter((id) => {
    const { state } = healthOf(rows[healthKey(topicId, id)], false, now)
    return state === 'failing' || state === 'empty'
  }).length
}
