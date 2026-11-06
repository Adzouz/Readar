import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export type AccountStatus =
  /** No Supabase settings: everything stays on this device. */
  | 'local'
  | 'connecting'
  | 'ready'
  /** Couldn't reach Supabase; the app keeps working from the local cache. */
  | 'offline'

export interface AccountState {
  status: AccountStatus
  userId: string | null
  /** Set once the user signed in with their email; null for the anonymous session. */
  email: string | null
}

export const useAccount = create<AccountState>()(() => ({
  status: supabase ? 'connecting' : 'local',
  userId: null,
  email: null,
}))

const fromSession = (session: Session | null): Partial<AccountState> => ({
  userId: session?.user.id ?? null,
  email: session?.user.is_anonymous ? null : (session?.user.email ?? null),
})

let markReady: () => void = () => {}
/** Resolves once start-up has a session (or gave up). Sign-in links wait for it. */
export const sessionReady = new Promise<void>((resolve) => {
  markReady = resolve
})

/**
 * Restores the saved session, or starts an anonymous one so the setup and lists can sync before
 * the user ever signs in. Returns the user id, or null when offline or without Supabase.
 */
export async function startSession(): Promise<string | null> {
  try {
    return await openSession()
  } finally {
    markReady()
  }
}

let listening = false
let onSessionLost: (() => void) | null = null

/** Called when Supabase drops the session (refresh token revoked or expired). */
export const setSessionLostHandler = (handler: (() => void) | null): void => {
  onSessionLost = handler
}

async function openSession(): Promise<string | null> {
  if (!supabase) return null
  if (!listening) {
    listening = true
    supabase.auth.onAuthStateChange((event, session) => {
      useAccount.setState(fromSession(session))
      if (event === 'SIGNED_OUT') onSessionLost?.()
    })
  }
  try {
    const { data } = await supabase.auth.getSession()
    let session = data.session
    if (!session) {
      const { data: created, error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      session = created.session
    }
    useAccount.setState({ status: 'ready', ...fromSession(session) })
    return session?.user.id ?? null
  } catch (error) {
    console.warn('Readar: Supabase unreachable, staying on this device for now.', error)
    useAccount.setState({ status: 'offline' })
    return null
  }
}

/**
 * Tries again to get a session after starting offline or losing it. Returns the user id, or null
 * while Supabase is still unreachable.
 */
export async function reconnect(): Promise<string | null> {
  const current = useAccount.getState().userId
  if (current) return current
  if (!supabase) return null
  useAccount.setState({ status: 'connecting' })
  return openSession()
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Try again.'

/** Emails a one-time code. Creates the account when the address is new. */
export async function sendCode(email: string): Promise<string | null> {
  if (!supabase) return 'Sync is not set up in this build.'
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  return error ? message(error) : null
}

/** Checks the code. On success the session switches to the email account. */
export async function verifyCode(email: string, token: string): Promise<string | null> {
  if (!supabase) return 'Sync is not set up in this build.'
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  return error ? message(error) : null
}
