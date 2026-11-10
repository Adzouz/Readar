import { describe, expect, it } from 'vitest'
import { SAMPLE_ITEMS } from '@/data/sample'
import { withSummary } from './summary'

const item = { ...SAMPLE_ITEMS[0]!, type: 'article' as const, length: '', summary: undefined }
const summary = { tldr: 'New TL;DR', points: ['a', 'b', 'c'], readingMinutes: 6 }

describe('withSummary', () => {
  it("adds Claude's summary and keeps the source's excerpt", () => {
    expect(withSummary(item, summary)).toMatchObject({
      excerpt: item.excerpt,
      summary: { tldr: 'New TL;DR', points: ['a', 'b', 'c'] },
      length: '6 min read',
    })
  })

  it('keeps the length the feed gave', () => {
    expect(withSummary({ ...item, length: '12 min read' }, summary).length).toBe('12 min read')
    expect(withSummary({ ...item, type: 'video' }, summary).length).toBe('6 min')
  })
})
