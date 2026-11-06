// Keeps `topics`, `sources` and `topic_sources` in line with the catalog and with what users follow.

import { CATALOG, keywordSources, type CatalogSource } from '@readar/core'
import { sql } from './db.ts'
import { log } from './log.ts'

async function upsertSuggested(source: CatalogSource): Promise<string | null> {
  try {
    const [row] = await sql<{ id: string }[]>`
      insert into public.sources (slug, url, feed_url, kind, name, site)
      values (${source.id}, ${source.feed}, ${source.feed}, ${source.kind}, ${source.name}, ${source.site})
      on conflict (slug) do update set
        url = excluded.url,
        feed_url = excluded.feed_url,
        kind = excluded.kind,
        name = excluded.name,
        site = excluded.site
      returning id`
    return row?.id ?? null
  } catch (error) {
    // Most likely the feed URL already belongs to another source (a link a user added).
    log.warn(`source ${source.id}: ${String(error)}`)
    const [row] = await sql<{ id: string }[]>`
      select id from public.sources where slug = ${source.id} or url = ${source.feed} limit 1`
    return row?.id ?? null
  }
}

/** Writes the catalog's topics and suggested sources. Safe to run on every start. */
export async function syncCatalog(): Promise<void> {
  for (const topic of CATALOG) {
    await sql`
      insert into public.topics (id, kind, name) values (${topic.id}, 'catalog', ${topic.name})
      on conflict (id) do update set name = excluded.name`
    const ids: string[] = []
    for (const source of topic.sources) {
      const id = await upsertSuggested(source)
      if (id) ids.push(id)
    }
    if (ids.length) {
      await sql`
        insert into public.topic_sources (topic_id, source_id)
        select ${topic.id}, unnest(${ids}::uuid[])
        on conflict do nothing`
    }
    // Sources dropped from the catalog stop feeding the topic.
    await sql`
      delete from public.topic_sources
      where topic_id = ${topic.id} and not (source_id = any(${ids}::uuid[]))`
  }
  log.info(`catalog: ${CATALOG.length} topics`)
}

/** Creates the keyword topics and the link sources users added since the last pass. */
export async function syncFollowed(): Promise<void> {
  const watches = await sql<{ topic_id: string; keyword: string }[]>`
    select distinct on (ut.topic_id) ut.topic_id, ut.keyword
    from public.user_topics ut
    where ut.keyword is not null
      and not exists (select 1 from public.topics t where t.id = ut.topic_id)
    order by ut.topic_id`
  for (const watch of watches) {
    await sql`
      insert into public.topics (id, kind, name, keyword)
      values (${watch.topic_id}, 'keyword', ${`“${watch.keyword}”`}, ${watch.keyword})
      on conflict (id) do nothing`
    for (const source of keywordSources(watch.keyword)) {
      await sql`
        insert into public.sources (slug, url, feed_url, kind, name, site)
        values (${source.id}, ${source.feed}, ${source.feed}, ${source.kind}, ${source.name}, ${source.site})
        on conflict do nothing`
      await sql`
        insert into public.topic_sources (topic_id, source_id)
        select ${watch.topic_id}, id from public.sources where slug = ${source.id}
        on conflict do nothing`
    }
    log.info(`keyword topic ${watch.topic_id}`)
  }

  const links = await sql<{ url: string }[]>`
    select distinct us.url from public.user_sources us
    where not exists (select 1 from public.sources s where s.url = us.url)`
  for (const { url } of links) {
    let host: string
    try {
      host = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      continue
    }
    await sql`
      insert into public.sources (url, kind, name, site)
      values (${url}, 'link', ${host}, ${host})
      on conflict do nothing`
    log.info(`link source ${host}`)
  }
}
