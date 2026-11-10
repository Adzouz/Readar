// Wires the app to Supabase: session, setup sync, cards and lists. Without Supabase settings this
// does nothing and the app runs on the device with sample cards.

import { supabase } from '@/lib/supabase'
import { useToast } from '@/shell/toast'
import { reconnect, setSessionLostHandler, startSession, useAccount } from './account'
import {
  clearLocalContent,
  connectDeckEffects,
  enqueueLists,
  flushOutbox,
  loadContent,
  restoreCachedContent,
  sinceLastLoad,
} from './content'
import { captureAuthLink, listenForAppLinks } from './authLink'
import { forgetSummaries } from './summaries'
import { applySaved, fetchSaved, pushSetup, pushSetupSoon, syncSetup, watchSetup } from './setup'

const REFRESH_AFTER_MS = 2 * 60 * 1000

const quietly = (task: Promise<unknown>): void => {
  task.catch((error: unknown) => console.warn('Readar sync:', error))
}

/** The account changed (email sign-in): adopt its setup, or carry this device's setup into it. */
async function onAccountSwitch(): Promise<void> {
  // Summaries belong to the account that paid for them.
  forgetSummaries()
  const saved = await fetchSaved()
  if (saved?.profile?.setup_completed) {
    applySaved(saved)
  } else {
    await pushSetup()
    enqueueLists()
    await flushOutbox()
  }
  await loadContent()
}

let signingOut = false
let resuming: Promise<void> | null = null

/**
 * Gets a session back after starting offline or losing it, then catches up: local changes go up,
 * fresh cards come down. Does nothing while a session exists.
 */
function resume(): Promise<void> {
  resuming ??= (async () => {
    if (useAccount.getState().userId) return
    const userId = await reconnect()
    if (!userId) return
    await syncSetup()
    await loadContent()
  })().finally(() => {
    resuming = null
  })
  return resuming
}

export async function startSync(): Promise<void> {
  if (!supabase) return
  captureAuthLink()
  quietly(listenForAppLinks())
  restoreCachedContent()
  connectDeckEffects()

  const userId = await startSession()

  watchSetup((topicsChanged) => {
    const saved = pushSetupSoon()
    // The server picks cards from the saved topics, so reload once they're saved.
    if (topicsChanged) quietly(saved.then(loadContent))
  })

  useAccount.subscribe((state, previous) => {
    if (state.userId && previous.userId && state.userId !== previous.userId) {
      quietly(onAccountSwitch())
    }
  })

  const refresh = () => {
    if (document.visibilityState === 'visible' && sinceLastLoad() > REFRESH_AFTER_MS) {
      quietly(loadContent())
    }
  }
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', refresh)
  window.addEventListener('online', () => {
    quietly(useAccount.getState().userId ? flushOutbox().then(loadContent) : resume())
  })
  setSessionLostHandler((hadEmail) => {
    if (signingOut) return
    // Falling back to a new anonymous session silently would hide that lists stopped syncing.
    if (hadEmail) useToast.getState().show('Signed out. Sign in again to keep syncing.')
    quietly(resume())
  })

  if (!userId) return
  await syncSetup()
  await loadContent()
}

/** Signs out and starts fresh on this device with a new anonymous session. */
export async function signOut(): Promise<void> {
  signingOut = true
  if (supabase) await supabase.auth.signOut({ scope: 'local' })
  clearLocalContent()
  for (const key of ['readar.setup', 'readar.sync']) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Ignore: reloading starts over anyway.
    }
  }
  window.location.reload()
}
