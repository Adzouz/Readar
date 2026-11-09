import { describe, expect, it } from 'vitest'
import type { SourceHealthRow } from '@/lib/database'
import { healthKey, healthOf, troubledCount } from './sourceHealth'

const NOW = Date.parse('2026-11-09T12:00:00Z')

const row = (fields: Partial<SourceHealthRow> = {}): SourceHealthRow => ({
  topic_id: 'ai',
  slug: 'example-feed',
  url: null,
  fetched_at: '2026-11-09T11:00:00Z',
  last_status: 200,
  last_error: null,
  error_count: 0,
  items: 12,
  latest_item_at: '2026-11-09T09:00:00Z',
  ...fields,
})

describe('healthOf', () => {
  it('counts articles and says how recent the latest is', () => {
    expect(healthOf(row(), false, NOW)).toEqual({
      state: 'ok',
      label: '12 articles · latest 3h ago',
    })
    expect(healthOf(row({ items: 1, latest_item_at: null }), false, NOW).label).toBe('1 article')
  })

  it('says Syncing only while a worker runs for links not fetched yet', () => {
    const link = row({ slug: null, url: 'https://example.com/', fetched_at: null, items: 0 })
    expect(healthOf(link, true, NOW)).toEqual({ state: 'waiting', label: 'Syncing…' })
    expect(healthOf(link, false, NOW)).toEqual({ state: 'waiting', label: 'Not fetched yet' })
    // A link saved after the last health load has no row yet.
    expect(healthOf(undefined, true, NOW).label).toBe('Syncing…')
    expect(healthOf(undefined, false, NOW).label).toBe('Not fetched yet')
  })

  it('flags a source that was fetched but brought nothing', () => {
    expect(healthOf(row({ items: 0, latest_item_at: null }), false, NOW).state).toBe('empty')
  })

  it('explains failures in plain words', () => {
    const noFeed = row({
      items: 0,
      error_count: 1,
      last_status: null,
      last_error: 'No feed found on this page',
    })
    expect(healthOf(noFeed, false, NOW)).toEqual({
      state: 'failing',
      label: "Can't fetch: no feed found on this page",
    })
    expect(healthOf(row({ items: 0, error_count: 1, last_status: 404 }), false, NOW).label).toBe(
      "Can't fetch: page not found",
    )
    expect(healthOf(row({ error_count: 2, last_status: 403 }), false, NOW).label).toBe(
      "Can't fetch: the site blocks Readar",
    )
  })

  it('gives a source with articles one failed fetch before flagging it', () => {
    expect(healthOf(row({ error_count: 1, last_status: 502 }), false, NOW).state).toBe('ok')
    expect(healthOf(row({ error_count: 2, last_status: 502 }), false, NOW).state).toBe('failing')
  })
})

describe('troubledCount', () => {
  it('counts failing and empty sources among the active ones only', () => {
    const rows = {
      [healthKey('ai', 'good')]: row({ slug: 'good' }),
      [healthKey('ai', 'empty')]: row({ slug: 'empty', items: 0 }),
      [healthKey('ai', 'broken')]: row({
        slug: 'broken',
        items: 0,
        error_count: 1,
        last_status: 404,
      }),
      [healthKey('ai', 'off')]: row({ slug: 'off', items: 0 }),
    }
    // "new" has no row yet: waiting, not counted.
    expect(troubledCount(rows, 'ai', ['good', 'empty', 'broken', 'new'], NOW)).toBe(2)
  })
})
