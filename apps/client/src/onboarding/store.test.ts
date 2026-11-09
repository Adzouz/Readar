import { beforeEach, describe, expect, it } from 'vitest'
import {
  activeSourceCount,
  followedTopics,
  keywordTopicId,
  normalizeUrl,
  openSources,
  suggestedSources,
  useSetup,
} from './store'

const initial = useSetup.getState()
beforeEach(() => useSetup.setState(initial, true))

describe('normalizeUrl', () => {
  it('adds https:// to bare domains and paths', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/')
    expect(normalizeUrl(' youtube.com/@channel ')).toBe('https://youtube.com/@channel')
  })

  it('keeps http and https links', () => {
    expect(normalizeUrl('http://example.com/feed.xml')).toBe('http://example.com/feed.xml')
  })

  it('rejects text, other schemes and hosts without a dot', () => {
    expect(normalizeUrl('')).toBeNull()
    expect(normalizeUrl('not a link')).toBeNull()
    expect(normalizeUrl('localhost')).toBeNull()
    expect(normalizeUrl('ftp://example.com')).toBeNull()
  })
})

describe('keyword watches', () => {
  it('builds stable ids from keywords', () => {
    expect(keywordTopicId('  Formula 1 ')).toBe('kw-formula-1')
    expect(keywordTopicId('Strapi')).toBe('kw-strapi')
  })

  it('adds a keyword once and refuses empty input', () => {
    const { addKeyword } = useSetup.getState()
    expect(addKeyword('Strapi')).toBe(true)
    expect(addKeyword(' strapi ')).toBe(false)
    expect(addKeyword('   ')).toBe(false)
    expect(useSetup.getState().keywords).toEqual([{ id: 'kw-strapi', keyword: 'Strapi' }])
  })

  it('removing a keyword also removes the links added to it', () => {
    const { addKeyword, addUserSource, removeKeyword } = useSetup.getState()
    addKeyword('Strapi')
    addUserSource('kw-strapi', 'strapi.io/blog')
    removeKeyword('kw-strapi')
    expect(useSetup.getState().userSources).toEqual([])
  })
})

describe('followed topics and sources', () => {
  it('lists catalog topics in the order picked, then keyword watches', () => {
    const { toggleTopic, addKeyword } = useSetup.getState()
    toggleTopic('design')
    toggleTopic('ai')
    addKeyword('Tauri')
    expect(followedTopics(useSetup.getState()).map((topic) => topic.id)).toEqual([
      'design',
      'ai',
      'kw-tauri',
    ])
  })

  it('counts suggested sources left on plus the user links', () => {
    const { toggleTopic, toggleSource, addUserSource } = useSetup.getState()
    toggleTopic('ai')
    const [first] = suggestedSources('ai', [])
    if (!first) throw new Error('AI topic has no suggested sources')
    toggleSource(first.id)
    expect(addUserSource('ai', 'example.com/feed.xml')).toBe(true)
    expect(addUserSource('ai', 'not a link')).toBe(false)
    const total = suggestedSources('ai', []).length
    expect(activeSourceCount(useSetup.getState(), 'ai')).toBe(total - 1 + 1)
  })

  it('suggests news and Hacker News searches for keyword watches', () => {
    const sources = suggestedSources('kw-strapi', [{ id: 'kw-strapi', keyword: 'Strapi' }])
    expect(sources.map((source) => source.site)).toEqual([
      'news.google.com',
      'news.ycombinator.com',
    ])
  })
})

describe('openSources', () => {
  it('remembers the topic it came from until the screen is left', () => {
    useSetup.setState({ step: 'done', completed: true })
    openSources('ai')
    expect(useSetup.getState()).toMatchObject({ step: 'sources', sourcesFrom: 'ai' })
    useSetup.getState().goTo('done')
    expect(useSetup.getState()).toMatchObject({ step: 'done', sourcesFrom: null })
  })

  it('forgets it when the topics step opens the screen', () => {
    openSources('ai')
    useSetup.getState().goTo('topics')
    useSetup.getState().goTo('sources')
    expect(useSetup.getState().sourcesFrom).toBeNull()
  })
})
