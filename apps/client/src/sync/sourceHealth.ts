// Whether each source the user reads actually brings articles, so the sources screen and the deck
// can flag the ones that don't (PLAN.md §11). The worker records the facts; this decides the state.
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
export const NOT_FETCHED: SourceHealth = { state: 'waiting', label: 'Not fetched yet' }

/** Turns a worker error into words people can act on. */
function problemOf(row: SourceHealthRow): string {
  const status = row.last_status ?? 0
  if (/no feed found/i.test(row.last_error ?? '')) return 'no feed found on this page'
  if (status === 404 || status === 410) return 'page not found'
  if (status === 401 || status === 403) return 'the site blocks Readar'
  if (status === 429) return 'the site is limiting requests'
  if (status >= 500) return 'the site is having trouble'
  return "couldn't reach it"
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
    if (row && row.error_count > 0)
      return { state: 'failing', label: `Can't fetch: ${problemOf(row)}` }
    return workerActive ? SYNCING : NOT_FETCHED
  }
  const failing = row.error_count >= 2 || (row.error_count >= 1 && row.items === 0)
  if (failing) return { state: 'failing', label: `Can't fetch: ${problemOf(row)}` }
  if (row.items === 0) return { state: 'empty', label: 'No recent articles found' }
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
