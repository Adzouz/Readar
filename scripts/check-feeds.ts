// Health check for the onboarding catalog: every feed must answer, parse as RSS/Atom and have
// entries. Run with `pnpm check:feeds` (Node strips the types). Exit code 1 if any feed fails.
import { CATALOG, keywordSources, type CatalogSource } from '../apps/client/src/data/catalog.ts'

const USER_AGENT = 'ReadarFeedCheck/0.1 (catalog health check)'
const STALE_DAYS = 120
const CONCURRENCY = 12

interface Result {
  topic: string
  source: CatalogSource
  ok: boolean
  stale: boolean
  status: number
  entries: number
  title: string
  newest: string
  redirect: string
}

async function check(topic: string, source: CatalogSource): Promise<Result> {
  const base = { topic, source, stale: false, entries: 0, title: '', newest: '-', redirect: '' }
  try {
    const response = await fetch(source.feed, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
    const body = await response.text()
    const isFeed = /<(rss|feed|rdf:RDF)[\s>]/i.test(body)
    const entries = (body.match(/<(item|entry)[\s>]/gi) ?? []).length
    const title = body.match(/<title[^>]*>\s*(?:<!\[CDATA\[)?\s*([^<\]]*)/i)?.[1]?.trim() ?? ''
    const dates = [...body.matchAll(/<(pubDate|updated|published|dc:date)>([^<]+)</gi)]
      .map((match) => Date.parse(match[2] ?? ''))
      .filter((time) => !Number.isNaN(time))
    const newestTime = dates.length ? Math.max(...dates) : 0
    return {
      ...base,
      ok: response.ok && isFeed && entries > 0,
      stale: newestTime > 0 && Date.now() - newestTime > STALE_DAYS * 86_400_000,
      status: response.status,
      entries,
      title,
      newest: newestTime ? new Date(newestTime).toISOString().slice(0, 10) : '-',
      redirect: response.url !== source.feed ? response.url : '',
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : String(error)
    return { ...base, ok: false, status: 0, title: name }
  }
}

const jobs: [string, CatalogSource][] = [
  ...CATALOG.flatMap((topic) =>
    topic.sources.map((source): [string, CatalogSource] => [topic.id, source]),
  ),
  ...keywordSources('Strapi').map((source): [string, CatalogSource] => ['keyword', source]),
]

const results: Result[] = []
const queue = [...jobs]
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) results.push(await check(...job))
  }),
)

const order = new Map(jobs.map(([, source], index) => [source.id, index]))
results.sort((a, b) => (order.get(a.source.id) ?? 0) - (order.get(b.source.id) ?? 0))

for (const r of results) {
  const flag = !r.ok ? 'FAIL ' : r.stale ? 'STALE' : 'ok   '
  const line = [
    flag,
    r.topic.padEnd(8),
    r.source.id.padEnd(20),
    String(r.status).padEnd(3),
    String(r.entries).padStart(4),
    r.newest,
    r.title.slice(0, 44),
    r.redirect ? `→ ${r.redirect}` : '',
  ]
  console.log(line.join('  '))
}

const failed = results.filter((r) => !r.ok)
const stale = results.filter((r) => r.ok && r.stale)
console.log(`\n${results.length - failed.length}/${results.length} feeds OK, ${stale.length} stale`)
process.exitCode = failed.length ? 1 : 0
