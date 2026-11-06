import { describe, expect, it } from 'vitest'
import { canonicalUrl, isWebUrl, keywordTopicId, normalizeUrl } from './url.ts'

describe('canonicalUrl', () => {
  it('drops tracking parameters, fragments and www', () => {
    expect(
      canonicalUrl('http://WWW.Example.com/post/?utm_source=x&b=2&a=1&fbclid=abc#comments'),
    ).toBe('https://example.com/post?a=1&b=2')
  })

  it('keeps the root path and resolves relative links', () => {
    expect(canonicalUrl('https://example.com/')).toBe('https://example.com/')
    expect(canonicalUrl('/a/b', 'https://example.com/feed.xml')).toBe('https://example.com/a/b')
  })

  it('rejects other schemes and garbage', () => {
    expect(canonicalUrl('mailto:me@example.com')).toBeNull()
    expect(canonicalUrl('not a url')).toBeNull()
  })
})

describe('isWebUrl', () => {
  it('accepts http(s) only', () => {
    expect(isWebUrl('https://example.com/a')).toBe(true)
    expect(isWebUrl('http://example.com')).toBe(true)
    expect(isWebUrl('javascript:alert(1)')).toBe(false)
    expect(isWebUrl('data:text/html,<p>x</p>')).toBe(false)
    expect(isWebUrl('/relative')).toBe(false)
  })
})

describe('normalizeUrl', () => {
  it('adds https and rejects hosts without a dot', () => {
    expect(normalizeUrl('example.com/blog')).toBe('https://example.com/blog')
    expect(normalizeUrl('localhost')).toBeNull()
  })
})

describe('keywordTopicId', () => {
  it('slugs the keyword', () => {
    expect(keywordTopicId('  Claude Code! ')).toBe('kw-claude-code')
  })
})
