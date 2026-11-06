import postgres from 'postgres'
import { required } from './env.ts'

/** Connects as the database owner: the worker writes shared content and bypasses RLS. */
export const sql = postgres(required('DATABASE_URL'), {
  max: 4,
  // Supabase's transaction pooler (port 6543) doesn't support prepared statements.
  prepare: false,
  onnotice: () => {},
})

export interface SourceRow {
  id: string
  slug: string | null
  url: string
  feed_url: string | null
  kind: string
  name: string
  site: string
  etag: string | null
  last_modified: string | null
  fetch_interval_seconds: number
  error_count: number
}
