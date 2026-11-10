import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FetchStatusRow } from '@/lib/database'

const fake = vi.hoisted(() => ({
  rpc: vi.fn<(name: string) => Promise<{ data: unknown; error: null | { message: string } }>>(),
  load: vi.fn<() => Promise<void>>(async () => {}),
  push: vi.fn<() => Promise<boolean>>(async () => true),
}))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: fake.rpc } }))
vi.mock('./content', () => ({ loadContent: fake.load }))
vi.mock('./setup', () => ({ pushSetup: fake.push }))
vi.mock('./sourceHealth', () => ({ loadSourceHealth: async () => {} }))

const { addsSources, fetchNewArticles, POLL_MS, GIVE_UP_MS, NOTICE_MS, SLOW_POLL_MS, useFetchNow } =
  await import('./fetchNow')
const { useToast } = await import('@/shell/toast')

const none = { topicIds: [], keywords: [], disabledSourceIds: [], userSources: [] }
const link = { id: 'user:ai:https://example.com', topicId: 'ai', url: 'https://example.com' }

describe('addsSources', () => {
  it('counts a new topic, keyword, link or a source switched back on', () => {
    expect(addsSources(none, { ...none, topicIds: ['ai'] })).toBe(true)
    expect(addsSources(none, { ...none, keywords: [{ id: 'kw-x', keyword: 'x' }] })).toBe(true)
    expect(addsSources(none, { ...none, userSources: [link] })).toBe(true)
    expect(addsSources({ ...none, disabledSourceIds: ['a'] }, none)).toBe(true)
  })

  it('ignores removals', () => {
    expect(addsSources({ ...none, userSources: [link] }, none)).toBe(false)
    expect(addsSources(none, { ...none, disabledSourceIds: ['a'] })).toBe(false)
  })
})

describe('fetchNewArticles', () => {
  const REQUESTED = '2026-11-10T12:00:00.000Z'
  const status = (row: Partial<FetchStatusRow>) => ({
    data: [{ requested_at: REQUESTED, done_at: null, worker_active: true, ...row }],
    error: null,
  })

  beforeEach(() => {
    vi.useFakeTimers()
    fake.rpc.mockReset()
    fake.load.mockClear()
    useFetchNow.setState({ status: 'idle' })
  })
  afterEach(() => vi.useRealTimers())

  it('shows fetching, then reloads the cards once the worker is done', async () => {
    fake.rpc.mockImplementation(async (name) =>
      name === 'request_fetch' ? { data: REQUESTED, error: null } : status({}),
    )
    const run = fetchNewArticles()
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(useFetchNow.getState().status).toBe('fetching')
    expect(fake.load).not.toHaveBeenCalled()

    fake.rpc.mockImplementation(async () => status({ done_at: '2026-11-10T12:00:20.000Z' }))
    await vi.advanceTimersByTimeAsync(POLL_MS)
    await run
    expect(fake.load).toHaveBeenCalledOnce()
    expect(useFetchNow.getState().status).toBe('idle')
    expect(useToast.getState().message).toMatch(/new articles yet/)
  })

  it('without a worker, says "within the hour", then reloads when the hourly run is done', async () => {
    let done: string | null = '2026-11-10T11:00:00.000Z' // an older pass
    fake.rpc.mockImplementation(async (name) =>
      name === 'request_fetch'
        ? { data: REQUESTED, error: null }
        : status({ done_at: done, worker_active: false }),
    )
    const run = fetchNewArticles()
    await vi.advanceTimersByTimeAsync(0)
    expect(useFetchNow.getState().status).toBe('scheduled')
    await vi.advanceTimersByTimeAsync(NOTICE_MS)
    expect(useFetchNow.getState().status).toBe('idle') // the notice goes, the watch goes on

    done = '2026-11-10T12:30:00.000Z' // the hourly run answered
    await vi.advanceTimersByTimeAsync(SLOW_POLL_MS)
    await run
    expect(fake.load).toHaveBeenCalledOnce()
  })

  it('stops watching after the hour and a bit', async () => {
    fake.rpc.mockImplementation(async (name) =>
      name === 'request_fetch'
        ? { data: REQUESTED, error: null }
        : status({ worker_active: false }),
    )
    const run = fetchNewArticles()
    await vi.advanceTimersByTimeAsync(GIVE_UP_MS + SLOW_POLL_MS)
    await run
    expect(fake.load).not.toHaveBeenCalled()
    expect(useFetchNow.getState().status).toBe('idle')
  })

  it('says so when the request fails instead of doing nothing', async () => {
    fake.rpc.mockResolvedValue({ data: null, error: { message: 'function not found' } })
    await fetchNewArticles()
    expect(useFetchNow.getState().status).toBe('idle')
    expect(useToast.getState().message).toMatch(/Couldn't fetch right away/)
  })

  it('says so when the setup could not be saved', async () => {
    fake.push.mockResolvedValueOnce(false)
    await fetchNewArticles()
    expect(fake.rpc).not.toHaveBeenCalled()
    expect(useToast.getState().message).toMatch(/Couldn't fetch right away/)
  })
})
