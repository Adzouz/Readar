import { describe, expect, it } from 'vitest'
import { stampFor } from './Deck'

describe('stampFor', () => {
  it('shows nothing near the start', () => {
    expect(stampFor(10, -10)).toBeNull()
  })

  it('shows one label on a diagonal drag: the stronger direction', () => {
    expect(stampFor(90, -40)?.action).toBe('like')
    expect(stampFor(-40, -90)?.action).toBe('later')
    expect(stampFor(-90, -40)?.action).toBe('nope')
  })

  it('matches the release rule: sideways wins once past the threshold', () => {
    expect(stampFor(120, -200)).toEqual({ action: 'like', progress: 1 })
    expect(stampFor(60, -200)).toEqual({ action: 'later', progress: 1 })
  })
})
