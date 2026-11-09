// Readar fetch worker. `pnpm worker` runs a loop; `pnpm worker:once` runs one pass and exits.

import { sql } from './db.ts'
import { extractArticle } from './extract.ts'
import { claimDue, fetchSource } from './fetch.ts'
import { log } from './log.ts'
import { pool } from './pool.ts'
import { syncCatalog, syncFollowed } from './sync.ts'

const once = process.argv.includes('--once')
const LOOP_MS = 60_000
const BATCH = 25
const FETCH_CONCURRENCY = 6
const EXTRACT_CONCURRENCY = 3

const state = { stopping: false }
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (state.stopping) process.exit(1)
    state.stopping = true
    log.info('stopping after this batch…')
  })
}

async function extract(items: { id: string; url: string }[]): Promise<void> {
  await pool(items, EXTRACT_CONCURRENCY, async (item) => {
    try {
      const article = await extractArticle(item.url)
      if (!article) return
      await sql`
        update public.items set
          content_text = ${article.text},
          reading_minutes = ${article.readingMinutes},
          excerpt = coalesce(excerpt, ${article.excerpt}),
          image_url = coalesce(image_url, ${article.imageUrl}),
          language = coalesce(language, ${article.language})
        where id = ${item.id}`
    } catch (error) {
      log.warn(`extract ${item.url}: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
}

/** Tells the app a worker is running, so sources waiting for a fetch show "Syncing…". */
async function beat(): Promise<void> {
  try {
    await sql`
      insert into public.worker_heartbeat (id, beat_at) values (1, now())
      on conflict (id) do update set beat_at = excluded.beat_at`
  } catch (error) {
    log.warn(`heartbeat: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Clears the heartbeat on exit, so the app stops saying "Syncing…" right away. */
async function rest(): Promise<void> {
  try {
    await sql`delete from public.worker_heartbeat`
  } catch (error) {
    log.warn(`heartbeat: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Fetches every due source, batch after batch. Returns how many items were added. */
async function pass(): Promise<number> {
  await beat()
  await syncFollowed()
  let added = 0
  while (!state.stopping) {
    const due = await claimDue(BATCH)
    if (!due.length) break
    const outcomes = await pool(due, FETCH_CONCURRENCY, fetchSource)
    added += outcomes.reduce((sum, outcome) => sum + outcome.added, 0)
    await extract(outcomes.flatMap((outcome) => outcome.toExtract))
    await beat()
  }
  await beat()
  return added
}

async function main(): Promise<void> {
  await syncCatalog()
  do {
    const started = Date.now()
    const added = await pass()
    log.info(`pass done: ${added} new items in ${Math.round((Date.now() - started) / 1000)}s`)
    if (once || state.stopping) break
    await new Promise((resolve) => setTimeout(resolve, LOOP_MS))
  } while (!state.stopping)
}

try {
  await main()
} finally {
  await rest()
  await sql.end({ timeout: 5 })
}
