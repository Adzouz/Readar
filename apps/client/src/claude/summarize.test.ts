import { APIConnectionError, APIError } from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { summaryProblem } from './summarize'

const status = (code: number, message = 'error') =>
  new APIError(code, undefined, message, new Headers())

describe('summaryProblem', () => {
  it('pauses summaries for credit and key trouble', () => {
    // No credit is a 400 invalid_request_error, not a 402.
    const credit = summaryProblem(
      status(400, '400 Your credit balance is too low to access the Anthropic API.'),
    )
    expect(credit).toEqual({ message: expect.stringMatching(/out of credit/), blocking: true })
    expect(summaryProblem(status(401))).toMatchObject({ blocking: true })
    expect(summaryProblem(status(403))).toMatchObject({ blocking: true })
  })

  it('keeps going after passing trouble', () => {
    expect(summaryProblem(status(429)).blocking).toBe(false)
    expect(summaryProblem(status(529)).message).toMatch(/busy/)
    expect(summaryProblem(new APIConnectionError({ message: 'fetch failed' })).blocking).toBe(false)
    expect(summaryProblem(status(400, 'max_tokens too large')).blocking).toBe(false)
  })
})
