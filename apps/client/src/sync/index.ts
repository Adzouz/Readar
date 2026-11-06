// Wires the app to Supabase: session, setup sync, cards and lists. Without Supabase settings this
// does nothing and the app runs on the device with sample cards.

import { supabase } from '@/lib/supabase'
import { useAccount, startSession } from './account'
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
import { applySaved, fetchSaved, pushSetup, pushSetupSoon, syncSetup, watchSetup } from './setup'

const REFRESH_AFTER_MS = 2 * 60 * 1000

const quietly = (task: Promise<unknown>): void => {
  task.catch((error: unknown) => console.warn('Readar sync:', error))
}

/** The account changed (email sign-in): adopt its setup, or carry this device's setup into it. */
async function onAccountSwitch(): Promise<void> {
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
  window.addEventListener('online', () => quietly(flushOutbox().then(loadContent)))

  if (!userId) return
  await syncSetup()
  await loadContent()
}

/** Signs out and starts fresh on this device with a new anonymous session. */
export async function signOut(): Promise<void> {
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
