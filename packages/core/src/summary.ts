// What Claude writes for each card, and the prompt that asks for it. Shared by the client (which
// calls Claude with the user's own key) and the summary spike script, so both use one prompt.
import { z } from 'zod'

/** The model the owner picked (PLAN.md §3). Don't change it without asking. */
export const SUMMARY_MODEL = 'claude-sonnet-5-5'

/** Bump when the prompt or schema changes: saved summaries keep the version they were written
 * with, and cards only show the current one. */
export const SUMMARY_PROMPT_VERSION = 1

/** Article text beyond this many characters is cut, to keep the cost per card predictable. */
export const SUMMARY_INPUT_CHARS = 20_000

export const SummarySchema = z.object({
  tldr: z.string().describe('One or two sentences, at most 30 words.'),
  points: z.array(z.string()).describe('Exactly 3 key points, each one short sentence.'),
  contentType: z.enum(['article', 'video', 'thread', 'podcast']),
  readingMinutes: z.number().int().describe('Minutes to read or watch the original.'),
})

export type Summary = z.infer<typeof SummarySchema>

export const SUMMARY_SYSTEM = `You write the summary shown on a card in Readar, a reader that turns new articles, videos and posts into short summaries people triage like a deck of cards.

Write for someone deciding in a few seconds whether the original is worth opening.
- tldr: one or two sentences, at most 30 words. Say what is new or what the piece argues, not what it is about.
- points: exactly 3 key points, each one short sentence with a concrete fact, number or claim from the text.
- contentType: what the original is (article, video, thread or podcast).
- readingMinutes: your estimate of the minutes needed to read or watch the original.

Use only what the text says. If the text is only a short excerpt, summarize what it says without inventing details, and keep the points to what it supports. Write in English, plainly, without hype.`

export interface SummaryInput {
  title: string
  url: string
  source: string | null
  /** Extracted article text, or the feed's excerpt when there is none. Cards without either keep
   * their excerpt-less layout and aren't sent to Claude. */
  text: string
}

/** The user message for one card, and whether the text was cut to SUMMARY_INPUT_CHARS. */
export function summaryPrompt(input: SummaryInput): { prompt: string; truncated: boolean } {
  const text = input.text.trim()
  const truncated = text.length > SUMMARY_INPUT_CHARS
  const body = truncated ? `${text.slice(0, SUMMARY_INPUT_CHARS)}\n[text cut here]` : text
  const lines = [
    `Title: ${input.title}`,
    input.source ? `Source: ${input.source}` : null,
    `URL: ${input.url}`,
    '',
    body,
  ]
  return { prompt: lines.filter((line) => line !== null).join('\n'), truncated }
}
