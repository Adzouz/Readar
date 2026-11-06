// Syncs the setup (style, onboarding progress, topics, sources) with Supabase.
// localStorage stays the cache: the app reads it first and works without a connection.
// Rule: changes made on this device that haven't reached Supabase yet win over the server copy.

import type { Json, SavedSetup, SetupPayload } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { useSetup } from '@/onboarding/store'
import { useTheme } from '@/theme/store'

const SYNC_KEY = 'readar.sync'
const PUSH_DELAY_MS = 800

function readPending(): boolean {
  try {
    const raw = localStorage.getItem(SYNC_KEY)
    return raw ? (JSON.parse(raw) as { pending?: boolean }).pending === true : false
  } catch {
    return false
  }
}

function writePending(pending: boolean): void {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ pending }))
  } catch {
    // Storage blocked: the next start pulls from the server instead.
  }
}

export function localPayload(): SetupPayload {
  const setup = useSetup.getState()
  const theme = useTheme.getState()
  return {
    style: theme.style,
    mode: theme.mode,
    step: setup.step,
    completed: setup.completed,
    disabledSourceIds: setup.disabledSourceIds,
    topics: [
      ...setup.topicIds.map((id) => ({ id })),
      ...setup.keywords.map(({ id, keyword }) => ({ id, keyword })),
    ],
    sources: setup.userSources.map(({ topicId, url }) => ({ topicId, url })),
  }
}

let applying = false

/** Replaces the local setup with the one saved in Supabase. */
export function applySaved(saved: SavedSetup): void {
  const profile = saved.profile
  if (!profile) return
  applying = true
  try {
    if (profile.style) useTheme.getState().setStyle(profile.style)
    if (profile.mode) useTheme.getState().setMode(profile.mode)
    useSetup.setState({
      step: profile.setup_completed ? 'done' : profile.setup_step,
      completed: profile.setup_completed,
      topicIds: saved.topics.filter((topic) => !topic.keyword).map((topic) => topic.id),
      keywords: saved.topics.flatMap((topic) =>
        topic.keyword ? [{ id: topic.id, keyword: topic.keyword }] : [],
      ),
      disabledSourceIds: profile.disabled_source_ids,
      userSources: saved.sources.map(({ topicId, url }) => ({
        id: `user:${topicId}:${url}`,
        topicId,
        url,
      })),
    })
  } finally {
    applying = false
  }
}

export async function fetchSaved(): Promise<SavedSetup | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_setup')
  if (error) throw error
  return data as unknown as SavedSetup
}

let timer: ReturnType<typeof setTimeout> | undefined
let waiting: (() => void)[] = []

async function push(): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('save_setup', {
    payload: localPayload() as unknown as Json,
  })
  if (error) {
    console.warn('Readar: setup not saved yet, will retry.', error.message)
    return false
  }
  writePending(false)
  return true
}

/** Saves the local setup now. Resolves true once Supabase has it. */
export async function pushSetup(): Promise<boolean> {
  clearTimeout(timer)
  writePending(true)
  const ok = await push()
  const resolve = waiting
  waiting = []
  for (const done of resolve) done()
  return ok
}

/** Saves the local setup shortly (changes come in bursts). Resolves after that save. */
export function pushSetupSoon(): Promise<void> {
  writePending(true)
  clearTimeout(timer)
  timer = setTimeout(() => void pushSetup(), PUSH_DELAY_MS)
  return new Promise((resolve) => waiting.push(resolve))
}

/**
 * First sync after start-up: unsaved local changes go up, otherwise the server copy comes down.
 * A new account (no profile yet) gets the local setup.
 */
export async function syncSetup(): Promise<void> {
  if (readPending()) {
    await pushSetup()
    return
  }
  const saved = await fetchSaved()
  if (saved?.profile) applySaved(saved)
  else await pushSetup()
}

/** Calls `onChange` for every local edit of the setup or the theme (not for server copies). */
export function watchSetup(onChange: (topicsChanged: boolean) => void): () => void {
  const offSetup = useSetup.subscribe((state, previous) => {
    if (applying) return
    if (
      state.step === previous.step &&
      state.completed === previous.completed &&
      state.topicIds === previous.topicIds &&
      state.keywords === previous.keywords &&
      state.disabledSourceIds === previous.disabledSourceIds &&
      state.userSources === previous.userSources
    ) {
      return
    }
    onChange(
      state.topicIds !== previous.topicIds ||
        state.keywords !== previous.keywords ||
        state.disabledSourceIds !== previous.disabledSourceIds ||
        state.userSources !== previous.userSources,
    )
  })
  const offTheme = useTheme.subscribe((state, previous) => {
    if (applying) return
    if (state.style !== previous.style || state.mode !== previous.mode) onChange(false)
  })
  return () => {
    offSetup()
    offTheme()
  }
}
