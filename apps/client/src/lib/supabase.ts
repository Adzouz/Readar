import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/**
 * The Supabase client, or null when `apps/client/.env.local` has no project settings. The app
 * then runs on the device only, with sample cards. Same in dev with `?offline` in the URL.
 */
// Dev only: `?offline` runs without Supabase (sample cards), for the UI scripts.
const offline =
  import.meta.env.DEV &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('offline')

export const supabase: SupabaseClient<Database> | null =
  url && key && !import.meta.env.VITEST && !offline
    ? createClient<Database>(url, key, {
        auth: { storageKey: 'readar.auth', persistSession: true, autoRefreshToken: true },
      })
    : null
