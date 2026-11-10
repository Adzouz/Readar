import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_ITEMS } from '@/data/sample'

const fake = vi.hoisted(() => ({
  key: vi.fn<() => Promise<string | null>>(),
  write: vi.fn<(key: string, input: unknown) => Promise<unknown>>(),
}))
// Sample mode (no Supabase): the card's own text is summarized and nothing is saved.
vi.mock('@/lib/supabase', () => ({ supabase: null }))
vi.mock('./key', () => ({ readClaudeKey: fake.key }))
vi.mock('./summarize', async (original) => ({
  ...(await original<typeof import('./summarize')>()),
  writeSummary: fake.write,
}))

const { APIError } = await import('@anthropic-ai/sdk')
const { deckStore } = await import('@/deck/store')
const { summarize, summarizeAhead, useSummaries, useSummarizeAhead } = await import('./summaries')

const written = {
  summary: {
    tldr: 'Claude TL;DR',
    points: ['one', 'two', 'three'],
    contentType: 'article',
    readingMinutes: 4,
  },
  model: 'claude-sonnet-5-5',
}
const ids = SAMPLE_ITEMS.map((item) => item.id)

beforeEach(() => {
  fake.key.mockReset().mockResolvedValue('sk-ant-api03-example')
  fake.write.mockReset().mockResolvedValue(written)
  deckStore.getState().setContent(SAMPLE_ITEMS, { liked: [], later: [], dismissed: [] })
  useSummaries.setState({ pending: {}, failed: {}, paused: null })
  useSummarizeAhead.setState({ ahead: false })
})

describe('summarize', () => {
  it('puts the summary on the card', async () => {
    expect(await summarize(ids[0]!)).toEqual({ ok: true })
    expect(deckStore.getState().items[ids[0]!]).toMatchObject({
      excerpt: SAMPLE_ITEMS[0]!.excerpt,
      summary: { tldr: 'Claude TL;DR', points: ['one', 'two', 'three'] },
    })
    expect(useSummaries.getState().pending).toEqual({})
  })

  it('asks for a key instead of calling Claude without one', async () => {
    fake.key.mockResolvedValue(null)
    expect(await summarize(ids[0]!)).toEqual({ ok: false, reason: 'no-key' })
    expect(fake.write).not.toHaveBeenCalled()
  })

  it('calls Claude once for a double press', async () => {
    const [first, second] = await Promise.all([summarize(ids[0]!), summarize(ids[0]!)])
    expect(first).toEqual({ ok: true })
    expect(second).toMatchObject({ ok: false })
    expect(fake.write).toHaveBeenCalledOnce()
  })

  it('pauses on no credit and keeps the excerpt', async () => {
    fake.write.mockRejectedValue(
      new APIError(400, undefined, 'Your credit balance is too low', new Headers()),
    )
    const result = await summarize(ids[0]!)
    expect(result).toMatchObject({ ok: false, reason: 'failed' })
    expect(useSummaries.getState().paused).toMatch(/out of credit/)
    expect(deckStore.getState().items[ids[0]!]?.summary).toBeUndefined()
  })
})

describe('summarizeAhead', () => {
  it('does nothing while the setting is off', async () => {
    await summarizeAhead(ids)
    expect(fake.write).not.toHaveBeenCalled()
  })

  it('summarizes the top card and the next five, no more', async () => {
    useSummarizeAhead.setState({ ahead: true })
    await summarizeAhead(ids)
    expect(fake.write).toHaveBeenCalledTimes(Math.min(6, ids.length))
  })

  it('stops after key or credit trouble', async () => {
    useSummarizeAhead.setState({ ahead: true })
    fake.write.mockRejectedValue(new APIError(401, undefined, 'invalid x-api-key', new Headers()))
    await summarizeAhead(ids)
    expect(fake.write).toHaveBeenCalledOnce()
  })

  it('stops on a rate limit without skipping those cards next time', async () => {
    useSummarizeAhead.setState({ ahead: true })
    fake.write.mockRejectedValueOnce(new APIError(429, undefined, 'rate limited', new Headers()))
    await summarizeAhead(ids)
    expect(fake.write).toHaveBeenCalledOnce()
    expect(useSummaries.getState().failed).toEqual({})

    await summarizeAhead(ids)
    expect(deckStore.getState().items[ids[0]!]?.summary?.tldr).toBe('Claude TL;DR')
  })
})

describe('summarizeAhead and lasting errors', () => {
  it('skips a card that fails the same way every time, and prepares the next ones', async () => {
    useSummarizeAhead.setState({ ahead: true })
    fake.write.mockRejectedValueOnce(new Error('unexpected answer'))
    await summarizeAhead(ids)
    expect(useSummaries.getState().failed[ids[0]!]).toBeDefined()
    expect(deckStore.getState().items[ids[1]!]?.summary).toBeDefined()

    const calls = fake.write.mock.calls.length
    await summarizeAhead(ids)
    expect(fake.write.mock.calls.length).toBe(calls) // no paid call again for the same card
  })
})

describe('account switch', () => {
  it('drops a summary that comes back after the switch', async () => {
    const { forgetSummaries } = await import('@/sync/summaries')
    fake.write.mockImplementation(async () => {
      forgetSummaries() // the user switched accounts while Claude was writing
      return written
    })
    expect(await summarize(ids[0]!)).toMatchObject({ ok: false })
    expect(deckStore.getState().items[ids[0]!]?.summary).toBeUndefined()
  })
})
