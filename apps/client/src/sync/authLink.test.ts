import { describe, expect, it } from 'vitest'
import { appLink, parseAuthLink } from './authLink'

describe('parseAuthLink', () => {
  it('reads web and app links', () => {
    const web = parseAuthLink('http://localhost:1420/auth?token_hash=abc&type=email')
    expect(web).toEqual({ tokenHash: 'abc', type: 'email' })
    expect(parseAuthLink(appLink({ tokenHash: 'a b', type: 'email' }))).toEqual({
      tokenHash: 'a b',
      type: 'email',
    })
  })

  it('ignores other pages, missing tokens and unknown types', () => {
    expect(parseAuthLink('http://localhost:1420/?token_hash=abc')).toBeNull()
    expect(parseAuthLink('http://localhost:1420/auth')).toBeNull()
    expect(parseAuthLink('http://localhost:1420/auth?token_hash=abc&type=recovery')).toBeNull()
  })
})
