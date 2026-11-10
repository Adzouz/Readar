// The Claude call for one card. Loaded only when a summary is asked for, so the SDK stays out of
// the app's first load. Same model, prompt and schema as `pnpm spike:summaries`.
import Anthropic, { APIConnectionError, APIError } from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import {
  SUMMARY_MODEL,
  SUMMARY_SYSTEM,
  SummarySchema,
  summaryPrompt,
  type Summary,
  type SummaryInput,
} from '@readar/core'

/** Why a summary failed, and whether summaries should pause until the user fixes something. */
export interface SummaryProblem {
  message: string
  /** Key or account trouble: every other call would fail the same way. */
  blocking: boolean
  /** Offline, rate limited or Claude busy: the same card can work in a minute. */
  transient: boolean
}

export function summaryProblem(error: unknown): SummaryProblem {
  if (error instanceof APIConnectionError) {
    return {
      message: "Couldn't reach Claude. Check your connection.",
      blocking: false,
      transient: true,
    }
  }
  if (error instanceof APIError) {
    // No credit comes back as a 400 invalid_request_error, not a 402.
    if (error.status === 400 && /credit balance/i.test(error.message)) {
      return {
        message: 'Your Claude Console account is out of credit. Add credit, then try again.',
        blocking: true,
        transient: false,
      }
    }
    if (error.status === 401) {
      return {
        message: "Claude didn't accept your key. Connect it again in Settings.",
        blocking: true,
        transient: false,
      }
    }
    if (error.status === 403) {
      return { message: "Your key isn't allowed to use the API.", blocking: true, transient: false }
    }
    if (error.status === 429) {
      return {
        message: 'Claude is limiting requests. Try again in a minute.',
        blocking: false,
        transient: true,
      }
    }
    if (error.status === 529 || (error.status ?? 0) >= 500) {
      return {
        message: 'Claude is busy right now. Try again in a moment.',
        blocking: false,
        transient: true,
      }
    }
  }
  // Anything else (an unexpected answer) would likely fail the same way again: a lasting skip.
  return { message: "Claude couldn't summarize this one.", blocking: false, transient: false }
}

export interface Written {
  summary: Summary
  /** The model that answered: a declined request can be retried on a fallback model. */
  model: string
}

/** Asks Claude for one card's summary with the user's own key. Throws API errors as they are. */
export async function writeSummary(key: string, input: SummaryInput): Promise<Written | null> {
  // The key belongs to the person using this app; the device is where it is meant to be used.
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 })
  const response = await client.beta.messages.parse({
    model: SUMMARY_MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(SummarySchema) },
    system: SUMMARY_SYSTEM,
    messages: [{ role: 'user', content: summaryPrompt(input).prompt }],
  })
  const summary = response.parsed_output
  if (response.stop_reason === 'refusal' || !summary) return null
  return { summary, model: response.model }
}
