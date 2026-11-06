import { describe, expect, it } from 'vitest'
import { applyPending, type Outbox } from './content'

const at = '2026-11-06T12:00:00Z'

describe('applyPending', () => {
  const server = { liked: ['a'], later: ['b'], dismissed: ['c'] }

  it('keeps the server lists when nothing is pending', () => {
    expect(applyPending(server, {})).toBe(server)
  })

  it('applies swipes, undos and reads the server has not seen yet', () => {
    const pending: Outbox = {
      d: { topicId: 't', state: 'liked', at }, // swiped during the reload
      a: { topicId: 't', state: null, at }, // undone: back to its deck
      b: { topicId: 't', state: 'read', at }, // marked read: leaves Read later
      c: { topicId: 't', state: 'later', at }, // moved from Dismissed to Read later
    }
    expect(applyPending(server, pending)).toEqual({ liked: ['d'], later: ['c'], dismissed: [] })
  })
})
