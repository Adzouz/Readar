// Whether this device has a Claude key, for Settings, onboarding and (next) the Summarize button.
// The key itself is never kept in memory here: it is read from storage when a call needs it.
import { create } from 'zustand'
import { forgetClaudeKey, isClaudeKeyShape, readClaudeKey, saveClaudeKey } from './key'

interface ClaudeState {
  status: 'loading' | 'none' | 'connected'
  /** Last four characters of the saved key, so people can tell which one it is. */
  hint: string | null
}

export const useClaude = create<ClaudeState>()(() => ({ status: 'loading', hint: null }))

const hintOf = (key: string): string => key.slice(-4)

export async function loadClaudeStatus(): Promise<void> {
  try {
    const key = await readClaudeKey()
    useClaude.setState(
      key ? { status: 'connected', hint: hintOf(key) } : { status: 'none', hint: null },
    )
  } catch {
    useClaude.setState({ status: 'none', hint: null })
  }
}

/** Checks the key with Claude, then saves it. Resolves null on success, else what went wrong. */
export async function connectClaude(raw: string): Promise<string | null> {
  const key = raw.trim()
  if (!isClaudeKeyShape(key)) {
    return "This doesn't look like a Claude API key. Console keys start with sk-ant-."
  }
  // The SDK loads only when a key is checked, so it stays out of the app's first load.
  const { checkClaudeKey } = await import('./check')
  const problem = await checkClaudeKey(key)
  if (problem) return problem
  try {
    await saveClaudeKey(key)
  } catch (error) {
    return error instanceof Error ? error.message : "Readar couldn't save the key."
  }
  useClaude.setState({ status: 'connected', hint: hintOf(key) })
  return null
}

export async function disconnectClaude(): Promise<void> {
  await forgetClaudeKey()
  useClaude.setState({ status: 'none', hint: null })
}
