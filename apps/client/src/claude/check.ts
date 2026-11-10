// Checks a Claude Console key before saving it, with the free models list call: no tokens, no
// charge. It can't tell whether the account has credit; the first summary finds that out.
import Anthropic, { APIConnectionError, APIError } from '@anthropic-ai/sdk'

/** Words people can act on for a failed check. */
export function keyProblem(error: unknown): string {
  if (error instanceof APIConnectionError) {
    return "Couldn't reach Claude. Check your connection and try again."
  }
  if (error instanceof APIError) {
    if (error.status === 401) {
      return "Claude didn't accept this key. Copy it again from the Claude Console."
    }
    if (error.status === 403) return "This key isn't allowed to use the API."
    if (error.status === 429) return 'Claude is limiting requests right now. Try again in a minute.'
  }
  return "Claude couldn't check the key right now. Try again in a moment."
}

/** Resolves null when Claude accepts the key, otherwise the reason it didn't. */
export async function checkClaudeKey(key: string): Promise<string | null> {
  // The key belongs to the person using this app; the browser is where it is meant to be used.
  const client = new Anthropic({
    apiKey: key,
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
    timeout: 15_000,
  })
  try {
    await client.models.list({ limit: 1 })
    return null
  } catch (error) {
    return keyProblem(error)
  }
}
