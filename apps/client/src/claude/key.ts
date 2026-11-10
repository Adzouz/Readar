// The user's own Claude Console API key (PLAN.md §6). Mac and iPhone keep it in the OS keychain
// through the Rust commands in src-tauri/src/secrets.rs; the web build keeps it in this browser's
// storage, which is weaker (any script running on the page could read it), and says so in the UI.
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/lib/platform'

const WEB_KEY = 'readar.claude'

/** Same check as the Rust side: Console keys start with `sk-ant-`. */
export const isClaudeKeyShape = (key: string): boolean =>
  /^sk-ant-[A-Za-z0-9_-]+$/.test(key) && key.length <= 256

/** Where the key lives on this platform, for the copy in Settings and onboarding. */
export const keyStorage = (): 'keychain' | 'browser' => (isTauri() ? 'keychain' : 'browser')

export async function readClaudeKey(): Promise<string | null> {
  if (isTauri()) return invoke<string | null>('claude_key_get')
  try {
    return localStorage.getItem(WEB_KEY)
  } catch {
    return null
  }
}

/** Saves the key. Rejects with a message when it isn't shaped like a Console key. */
export async function saveClaudeKey(raw: string): Promise<void> {
  const key = raw.trim()
  if (!isClaudeKeyShape(key)) throw new Error("This doesn't look like a Claude API key.")
  if (isTauri()) return invoke('claude_key_set', { key })
  try {
    localStorage.setItem(WEB_KEY, key)
  } catch {
    throw new Error("This browser won't let Readar save the key.")
  }
}

export async function forgetClaudeKey(): Promise<void> {
  if (isTauri()) return invoke('claude_key_delete')
  try {
    localStorage.removeItem(WEB_KEY)
  } catch {
    // Nothing saved, or storage blocked: either way no key is kept.
  }
}
