import { describe, expect, it } from 'vitest'
import { SAMPLE_ITEMS } from '@/data/sample'
import { withSummary } from './summary'

const item = { ...SAMPLE_ITEMS[0]!, type: 'article' as const, length: '', summarized: false }
const summary = { tldr: 'New TL;DR', points: ['a', 'b', 'c'], readingMinutes: 6 }

describe('withSummary', () => {
  it("swaps the excerpt for Claude's summary and marks it", () => {
    expect(withSummary(item, summary)).toMatchObject({
      tldr: 'New TL;DR',
      points: ['a', 'b', 'c'],
      summarized: true,
      length: '6 min read',
    })
  })

  it('keeps the length the feed gave', () => {
    expect(withSummary({ ...item, length: '12 min read' }, summary).length).toBe('12 min read')
    expect(withSummary({ ...item, type: 'video' }, summary).length).toBe('6 min')
  })
})
