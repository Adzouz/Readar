import { APIConnectionError, APIError } from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { keyProblem } from './check'

const status = (code: number) => new APIError(code, undefined, 'error', new Headers())

describe('keyProblem', () => {
  it('tells a rejected key from a key without API access', () => {
    expect(keyProblem(status(401))).toMatch(/didn't accept this key/)
    expect(keyProblem(status(403))).toMatch(/isn't allowed to use the API/)
  })

  it('tells connection trouble and rate limits apart from bad keys', () => {
    expect(keyProblem(new APIConnectionError({ message: 'fetch failed' }))).toMatch(
      /Couldn't reach Claude/,
    )
    expect(keyProblem(status(429))).toMatch(/limiting requests/)
    expect(keyProblem(status(529))).toMatch(/couldn't check the key right now/)
    expect(keyProblem(new Error('boom'))).toMatch(/couldn't check the key right now/)
  })
})
