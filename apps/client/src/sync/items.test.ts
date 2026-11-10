import { describe, expect, it } from 'vitest'
import type { ItemCardRow } from '@/lib/database'
import { ageOf, toItem } from './items'

const NOW = Date.parse('2026-11-06T12:00:00Z')

const row = (fields: Partial<ItemCardRow> = {}): ItemCardRow => ({
  id: '00000000-0000-4000-8000-000000000001',
  url: 'https://www.example.com/post',
  title: 'Title',
  author: null,
  published_at: '2026-11-06T09:00:00Z',
  image_url: null,
  excerpt: 'Excerpt',
  content_type: 'article',
  reading_minutes: 4,
  source_name: 'Example',
  coverage: 3,
  ...fields,
})

describe('ageOf', () => {
  it('shows short relative ages', () => {
    expect(ageOf('2026-11-06T11:59:40Z', NOW)).toBe('now')
    expect(ageOf('2026-11-06T11:48:00Z', NOW)).toBe('12m')
    expect(ageOf('2026-11-06T09:00:00Z', NOW)).toBe('3h')
    expect(ageOf('2026-11-03T12:00:00Z', NOW)).toBe('3d')
    expect(ageOf(null, NOW)).toBe('')
  })
})

describe('toItem', () => {
  it('maps a row to a card', () => {
    const item = toItem(row(), { id: 'ai', name: 'AI' }, NOW)
    expect(item).toMatchObject({
      topicId: 'ai',
      source: 'Example',
      age: '3h',
      length: '4 min read',
      excerpt: 'Excerpt',
      why: 'Matches: AI',
      alsoCoveredBy: 2,
    })
  })

  it('refuses links that are not http(s)', () => {
    expect(toItem(row({ url: 'javascript:alert(1)' }), { id: 'ai', name: 'AI' }, NOW)).toBeNull()
  })

  it('falls back to the host and leaves unknown lengths empty', () => {
    const item = toItem(
      row({ source_name: null, reading_minutes: null, excerpt: null, coverage: 1 }),
      { id: 'ai', name: 'AI' },
      NOW,
    )
    expect(item?.source).toBe('example.com')
    expect(item?.length).toBe('')
    expect(item?.alsoCoveredBy).toBe(0)
    expect(item?.excerpt).toMatch(/No preview/)
  })
})
