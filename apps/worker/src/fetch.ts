// Fetches due sources and writes their new entries to `items`.

import { createHash } from 'node:crypto'
import { canonicalUrl } from '@readar/core'
import { sql, type SourceRow } from './db.ts'
import { decodeGoogleNewsLink, isGoogleNewsLink } from './gnews.ts'
import { FEED_ACCEPT, get, HTML_ACCEPT } from './http.ts'
import { log } from './log.ts'
import { looksLikeFeed, parseEntries, type Entry } from './parse.ts'
import { readingMinutes } from './text.ts'
import { channelIdOf, uploadsFromApi } from './youtube.ts'

const MIN_INTERVAL_S = 15 * 60
const MAX_INTERVAL_S = 6 * 60 * 60
const MAX_BACKOFF_S = 24 * 60 * 60
/** Entries older than this are skipped, so a new source doesn't flood the deck with its archive. */
const MAX_AGE_DAYS = 45
const MAX_ENTRIES = 30

export const hashUrl = (url: string): string =>
  createHash('sha256')
    .update(canonicalUrl(url) ?? url)
    .digest('hex')

/** Sources someone follows whose next fetch is due, marked as taken so others skip them. */
export async function claimDue(limit: number): Promise<SourceRow[]> {
  return sql<SourceRow[]>`
    update public.sources s
    set next_fetch_at = now() + interval '15 minutes'
    where s.id in (
      select s2.id from public.sources s2
      where s2.next_fetch_at <= now()
        and (
          exists (
            select 1 from public.topic_sources ts
            join public.user_topics ut on ut.topic_id = ts.topic_id
            where ts.source_id = s2.id
          )
          or exists (select 1 from public.user_sources us where us.url = s2.url)
        )
      order by s2.next_fetch_at
      limit ${limit}
      for update skip locked
    )
    returning s.id, s.slug, s.url, s.feed_url, s.kind, s.name, s.site, s.etag, s.last_modified,
      extract(epoch from s.fetch_interval)::integer as fetch_interval_seconds, s.error_count`
}

export interface FetchOutcome {
  added: number
  /** New items worth reading in full (articles whose feed only has an excerpt). */
  toExtract: { id: string; url: string }[]
}

/** Finds the feed of a link a user added: the page itself, or a feed it advertises. */
async function discoverFeed(
  source: SourceRow,
): Promise<{ feed: string; title: string | null } | null> {
  const page = await get(source.url, { accept: `${FEED_ACCEPT}, ${HTML_ACCEPT}` })
  if (page.status !== 200) throw new Error(`HTTP ${page.status}`)
  if (looksLikeFeed(page.body)) {
    return { feed: page.url, title: parseEntries(page.body, 'feed', page.url).title }
  }
  const links = [...page.body.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0])
  for (const tag of links) {
    if (!/rel=["']?alternate/i.test(tag)) continue
    if (!/type=["']?application\/(rss|atom|feed)\+(xml|json)/i.test(tag)) continue
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1]
    if (!href) continue
    const feed = new URL(href.replace(/&amp;/g, '&'), page.url).href
    const title = /title=["']([^"']+)["']/i.exec(tag)?.[1] ?? null
    return { feed, title }
  }
  return null
}

async function readFeed(
  source: SourceRow,
  feedUrl: string,
): Promise<
  | { entries: Entry[]; etag: string | null; lastModified: string | null; status: number }
  | 'unchanged'
> {
  const conditional: Record<string, string> = {}
  if (source.etag) conditional['if-none-match'] = source.etag
  if (source.last_modified) conditional['if-modified-since'] = source.last_modified
  const response = await get(feedUrl, { accept: FEED_ACCEPT, headers: conditional })
  if (response.status === 304) return 'unchanged'
  if (response.status !== 200) {
    const channel = source.kind === 'youtube' ? channelIdOf(feedUrl) : null
    const fallback = channel ? await uploadsFromApi(channel) : null
    if (fallback) return { entries: fallback, etag: null, lastModified: null, status: 200 }
    throw new Error(`HTTP ${response.status}`)
  }
  return {
    entries: parseEntries(response.body, source.kind, response.url).entries,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    status: response.status,
  }
}

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Google News titles end with " - Publisher"; the card shows the publisher separately. */
const stripPublisher = (title: string, publisher: string | null): string =>
  publisher && title.endsWith(` - ${publisher}`)
    ? title.slice(0, -(publisher.length + 3)).trimEnd()
    : title

async function existingItem(hash: string): Promise<string | null> {
  const [row] = await sql<{ id: string }[]>`
    select id from public.items where url_hash = ${hash}
    union all
    select item_id from public.item_aliases where alias_hash = ${hash}
    limit 1`
  return row?.id ?? null
}

async function link(itemId: string, sourceId: string): Promise<void> {
  await sql`
    insert into public.item_sources (item_id, source_id) values (${itemId}, ${sourceId})
    on conflict do nothing`
}

async function alias(hash: string, itemId: string): Promise<void> {
  await sql`
    insert into public.item_aliases (alias_hash, item_id) values (${hash}, ${itemId})
    on conflict do nothing`
}

/** Stores one entry. Returns the new item, or null when it was already known. */
async function store(source: SourceRow, entry: Entry): Promise<{ id: string; url: string } | null> {
  const wrapperHash = hashUrl(entry.url)
  const known = await existingItem(wrapperHash)
  if (known) {
    await link(known, source.id)
    return null
  }

  let url = entry.url
  if (isGoogleNewsLink(url)) url = (await decodeGoogleNewsLink(url)) ?? url
  const hash = hashUrl(url)
  if (hash !== wrapperHash) {
    const same = await existingItem(hash)
    if (same) {
      await alias(wrapperHash, same)
      await link(same, source.id)
      return null
    }
  }

  const named = entry.publisher && !/^https?:\/\//.test(entry.publisher) ? entry.publisher : null
  const publisher = source.kind === 'search' ? (named ?? hostOf(url)) : null
  const minutes = entry.fullText
    ? readingMinutes(entry.fullText)
    : entry.durationSeconds
      ? Math.max(1, Math.round(entry.durationSeconds / 60))
      : null
  const [row] = await sql<{ id: string; inserted: boolean }[]>`
    insert into public.items (
      url, url_hash, title, author, published_at, image_url, excerpt, content_text,
      content_type, reading_minutes, publisher
    ) values (
      ${url}, ${hash}, ${stripPublisher(entry.title, entry.publisher)}, ${entry.author},
      ${entry.publishedAt}, ${entry.imageUrl}, ${entry.excerpt}, ${entry.fullText},
      ${entry.type}, ${minutes}, ${publisher}
    )
    on conflict (url_hash) do update set url_hash = excluded.url_hash
    returning id, (xmax = 0) as inserted`
  if (!row) return null
  if (hash !== wrapperHash) await alias(wrapperHash, row.id)
  await link(row.id, source.id)
  return row.inserted ? { id: row.id, url } : null
}

async function succeed(
  source: SourceRow,
  added: number,
  extra: { etag?: string | null; lastModified?: string | null; status: number },
): Promise<void> {
  const current = source.fetch_interval_seconds || 30 * 60
  const next =
    added > 0
      ? Math.max(MIN_INTERVAL_S, Math.round(current / 2))
      : Math.min(MAX_INTERVAL_S, Math.round(current * 1.5))
  await sql`
    update public.sources set
      etag = coalesce(${extra.etag ?? null}, etag),
      last_modified = coalesce(${extra.lastModified ?? null}, last_modified),
      last_fetched_at = now(),
      last_status = ${extra.status},
      last_error = null,
      error_count = 0,
      fetch_interval = make_interval(secs => ${next}),
      next_fetch_at = now() + make_interval(secs => ${next})
    where id = ${source.id}`
}

async function fail(source: SourceRow, error: unknown, retryAfterS?: number): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const status = Number(/HTTP (\d+)/.exec(message)?.[1] ?? 0) || null
  const backoff = retryAfterS ?? Math.min(MAX_BACKOFF_S, MIN_INTERVAL_S * 2 ** source.error_count)
  await sql`
    update public.sources set
      last_fetched_at = now(),
      last_status = ${status},
      last_error = ${message.slice(0, 500)},
      error_count = error_count + 1,
      next_fetch_at = now() + make_interval(secs => ${backoff})
    where id = ${source.id}`
  log.warn(`${source.slug ?? source.url}: ${message}`)
}

export async function fetchSource(source: SourceRow): Promise<FetchOutcome> {
  const outcome: FetchOutcome = { added: 0, toExtract: [] }
  try {
    let feedUrl = source.feed_url
    if (!feedUrl) {
      const found = await discoverFeed(source)
      if (!found) {
        // Pages without a feed wait for the page watcher (Phase 2); check again daily.
        await fail(source, new Error('No feed found on this page'), MAX_BACKOFF_S)
        return outcome
      }
      feedUrl = found.feed
      const kind = /youtube\.com\/feeds\//.test(feedUrl) ? 'youtube' : 'feed'
      await sql`
        update public.sources
        set feed_url = ${feedUrl}, kind = ${kind}, name = coalesce(${found.title}, name)
        where id = ${source.id}`
      source = { ...source, feed_url: feedUrl, kind, etag: null, last_modified: null }
    }

    const result = await readFeed(source, feedUrl)
    if (result === 'unchanged') {
      await succeed(source, 0, { status: 304 })
      return outcome
    }

    const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000
    const entries = result.entries
      .filter((entry) => !entry.publishedAt || entry.publishedAt.getTime() >= cutoff)
      .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
      .slice(0, MAX_ENTRIES)

    for (const entry of entries) {
      const item = await store(source, entry)
      if (!item) continue
      outcome.added += 1
      if (entry.type === 'article' && !entry.fullText && !isGoogleNewsLink(item.url)) {
        outcome.toExtract.push(item)
      }
    }
    await succeed(source, outcome.added, result)
    if (outcome.added) log.info(`${source.slug ?? source.url}: +${outcome.added}`)
  } catch (error) {
    await fail(source, error)
  }
  return outcome
}
