// Sign-in links from the email: https://<site>/auth?token_hash=…&type=email opens the web app,
// which offers to hand off to the installed app through readar://auth?token_hash=…&type=email.

import type { EmailOtpType } from '@supabase/supabase-js'
import { create } from 'zustand'
import { isTauri } from '@/lib/platform'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/shell/toast'
import { sessionReady } from './account'

export interface AuthLink {
  tokenHash: string
  type: EmailOtpType
}

const TYPES: readonly EmailOtpType[] = ['email', 'signup', 'magiclink']

/** Reads a sign-in link (web /auth page or readar://auth). Null for anything else. */
export function parseAuthLink(href: string): AuthLink | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  const isAuth =
    url.protocol === 'readar:'
      ? url.hostname === 'auth' || url.pathname.replace(/^\/+/, '').startsWith('auth')
      : url.pathname.replace(/\/+$/, '') === '/auth'
  const tokenHash = url.searchParams.get('token_hash')
  const type = (url.searchParams.get('type') ?? 'email') as EmailOtpType
  if (!isAuth || !tokenHash || !TYPES.includes(type)) return null
  return { tokenHash, type }
}

export const appLink = (link: AuthLink): string =>
  `readar://auth?token_hash=${encodeURIComponent(link.tokenHash)}&type=${link.type}`

/** A sign-in link the web app was opened with, waiting for the user to pick app or browser. */
export const useAuthLink = create<{ link: AuthLink | null }>()(() => ({ link: null }))

/** Signs in with the link's token. Returns an error message, or null on success. */
export async function confirmAuthLink(link: AuthLink): Promise<string | null> {
  if (!supabase) return 'Sync is not set up in this build.'
  await sessionReady
  const { error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
  if (!error) return null
  return /expired|invalid/i.test(error.message)
    ? 'This sign-in link has expired or was already used. Send a new code from Settings.'
    : error.message
}

/** Web: takes a sign-in link out of the address bar and keeps it for the prompt. */
export function captureAuthLink(): void {
  if (isTauri() || typeof location === 'undefined') return
  const link = parseAuthLink(location.href)
  if (!link) return
  // The token is single-use; keep it out of the history and the address bar.
  history.replaceState(null, '', '/')
  useAuthLink.setState({ link })
}

async function signInFrom(urls: string[]): Promise<void> {
  for (const url of urls) {
    const link = parseAuthLink(url)
    if (!link) continue
    const failure = await confirmAuthLink(link)
    useToast.getState().show(failure ?? 'Signed in. Your topics and lists now sync.')
    return
  }
}

/** Mac and iPhone apps: signs in when opened from a readar://auth link. */
export async function listenForAppLinks(): Promise<void> {
  if (!isTauri() || !supabase) return
  const { getCurrent, onOpenUrl } = await import('@tauri-apps/plugin-deep-link')
  await onOpenUrl((urls) => void signInFrom(urls))
  const launchedWith = await getCurrent()
  if (launchedWith) await signInFrom(launchedWith)
}
