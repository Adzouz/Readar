// Summary spike (PLAN.md §11 step 4): summarizes real items from Supabase with the shared prompt
// and reports quality samples, tokens, cost and latency. Dev only: it reads ANTHROPIC_API_KEY
// from the repo root .env or .env.local, and writes nothing to the database.
//
//   pnpm spike:summaries [--limit 50] [--compare 20] [--out <dir>]
//
// Every item runs with adaptive thinking at low effort; the first --compare items also run with
// thinking off (`between_tools`) to compare quality and cost. The report goes to --out (default:
// the OS temp directory), never into the repo.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import Anthropic, { APIError } from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import postgres from 'postgres'
import {
  SUMMARY_MODEL,
  SUMMARY_SYSTEM,
  SummarySchema,
  summaryPrompt,
  type Summary,
} from '../packages/core/src/summary.ts'

for (const name of ['.env.local', '.env']) {
  const file = fileURLToPath(new URL(`../${name}`, import.meta.url))
  if (existsSync(file)) process.loadEnvFile(file)
}

const { values: args } = parseArgs({
  options: {
    limit: { type: 'string', default: '50' },
    compare: { type: 'string', default: '20' },
    out: { type: 'string', default: tmpdir() },
  },
})
const LIMIT = Number(args.limit)
const COMPARE = Number(args.compare)
const CONCURRENCY = 4
// Claude Sonnet 5.5, USD per million tokens.
const PRICE_IN = 2
const PRICE_OUT = 10

for (const name of ['DATABASE_URL', 'ANTHROPIC_API_KEY']) {
  if (!process.env[name]?.trim()) {
    console.error(`${name} is missing. Add it to the repo root .env or .env.local.`)
    process.exit(1)
  }
}

type Variant = 'adaptive' | 'off'

interface Row {
  id: string
  title: string
  url: string
  source: string
  content_type: string
  reading_minutes: number | null
  text: string
  has_content: boolean
}

interface Result {
  item: Row
  variant: Variant
  ms: number
  inputTokens: number
  outputTokens: number
  cost: number
  truncated: boolean
  stopReason: string | null
  fallback: boolean
  summary: Summary | null
  error: string | null
}

const sql = postgres(process.env.DATABASE_URL!, { max: 2, prepare: false, onnotice: () => {} })

// Spread over sources: the newest items of each source first, round robin.
const rows = await sql<Row[]>`
  select id, title, url, source, content_type, reading_minutes, text, has_content
  from (
    select i.id, i.title, i.url, s.name as source, i.content_type, i.reading_minutes,
      coalesce(nullif(i.content_text, ''), i.excerpt) as text,
      i.content_text is not null and i.content_text <> '' as has_content,
      row_number() over (
        partition by s.id order by coalesce(i.published_at, i.fetched_at) desc
      ) as rank
    from public.items i
    join lateral (
      select src.id, src.name from public.item_sources link
      join public.sources src on src.id = link.source_id
      where link.item_id = i.id
      order by link.seen_at
      limit 1
    ) s on true
    where coalesce(nullif(i.content_text, ''), i.excerpt) is not null
  ) ranked
  order by rank, id
  limit ${LIMIT}
`
await sql.end()
console.log(`${rows.length} items from ${new Set(rows.map((row) => row.source)).size} sources`)

const client = new Anthropic()

async function summarize(item: Row, variant: Variant): Promise<Result> {
  const { prompt, truncated } = summaryPrompt(item)
  const started = Date.now()
  const base = { item, variant, truncated }
  try {
    const response = await client.beta.messages.parse({
      model: SUMMARY_MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      ...(variant === 'off' ? { thinking: { type: 'between_tools' as const } } : {}),
      output_config: { effort: 'low', format: betaZodOutputFormat(SummarySchema) },
      system: SUMMARY_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })
    const { input_tokens: inputTokens, output_tokens: outputTokens } = response.usage
    return {
      ...base,
      ms: Date.now() - started,
      inputTokens,
      outputTokens,
      cost: (inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1e6,
      stopReason: response.stop_reason,
      fallback: (response.usage.iterations ?? []).some(
        (entry) => entry.type === 'fallback_message',
      ),
      summary: response.stop_reason === 'refusal' ? null : response.parsed_output,
      error: null,
    }
  } catch (error) {
    return {
      ...base,
      ms: Date.now() - started,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      stopReason: null,
      fallback: false,
      summary: null,
      error: error instanceof APIError ? `${error.status ?? '?'} ${error.message}` : String(error),
    }
  }
}

const jobs: [Row, Variant][] = [
  ...rows.map((row): [Row, Variant] => [row, 'adaptive']),
  ...rows.slice(0, COMPARE).map((row): [Row, Variant] => [row, 'off']),
]
const results: Result[] = []
let next = 0
let failures = 0
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length) {
      const [row, variant] = jobs[next++]!
      const result = await summarize(row, variant)
      results.push(result)
      const status = result.error ? 'error' : (result.stopReason ?? '?')
      console.log(`${results.length}/${jobs.length} ${variant} ${status} ${result.ms} ms`)
      // Auth and billing failures (no credit is a 400) fail every call: stop early.
      failures = result.error ? failures + 1 : 0
      if (failures >= 3) {
        console.error(`Stopping after 3 failures in a row: ${result.error}`)
        process.exit(1)
      }
    }
  }),
)

// --- Report ---------------------------------------------------------------------------------

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0
}
const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0)

function stats(variant: Variant) {
  const all = results.filter((result) => result.variant === variant)
  const ok = all.filter((result) => result.summary)
  return {
    runs: all.length,
    ok: ok.length,
    refusals: all.filter((result) => result.stopReason === 'refusal').length,
    fallbacks: all.filter((result) => result.fallback).length,
    errors: all.filter((result) => result.error).length,
    medianIn: median(ok.map((result) => result.inputTokens)),
    medianOut: median(ok.map((result) => result.outputTokens)),
    medianMs: median(ok.map((result) => result.ms)),
    perThousand: ok.length ? (sum(ok.map((result) => result.cost)) / ok.length) * 1000 : 0,
    total: sum(all.map((result) => result.cost)),
    longTldr: ok.filter((result) => result.summary!.tldr.split(/\s+/).length > 30).length,
    notThreePoints: ok.filter((result) => result.summary!.points.length !== 3).length,
  }
}

const table = (['adaptive', 'off'] as const)
  .map((variant) => {
    const s = stats(variant)
    return `| ${variant} | ${s.runs} | ${s.ok} | ${s.refusals} | ${s.fallbacks} | ${s.errors} | ${s.medianIn} | ${s.medianOut} | ${s.medianMs} | $${s.perThousand.toFixed(2)} | $${s.total.toFixed(3)} | ${s.longTldr} | ${s.notThreePoints} |`
  })
  .join('\n')

const card = (result: Result): string => {
  if (!result.summary) return `_No summary: ${result.error ?? result.stopReason}_`
  const { tldr, points, contentType, readingMinutes } = result.summary
  return [
    `**${tldr}**`,
    ...points.map((point) => `- ${point}`),
    `_${contentType}, ${readingMinutes} min (worker: ${result.item.content_type}, ${result.item.reading_minutes ?? '?'} min) · ${result.inputTokens} in / ${result.outputTokens} out · ${result.ms} ms_`,
  ].join('\n')
}

const samples = rows
  .map((row) => {
    const of = (variant: Variant) =>
      results.find((result) => result.item.id === row.id && result.variant === variant)
    const adaptive = of('adaptive')
    const off = of('off')
    return [
      `### ${row.title}`,
      `${row.source} · ${row.url} · input: ${row.has_content ? 'extracted text' : 'feed excerpt'}${adaptive?.truncated ? ' (cut)' : ''}`,
      '',
      adaptive ? `Adaptive thinking:\n\n${card(adaptive)}` : '',
      off ? `\nThinking off:\n\n${card(off)}` : '',
    ].join('\n')
  })
  .join('\n\n')

const report = `# Readar summary spike, ${new Date().toISOString().slice(0, 16).replace('T', ' ')}

Model \`${SUMMARY_MODEL}\`, effort \`low\`, structured output, \`fallbacks: "default"\`. Prices: $${PRICE_IN} in / $${PRICE_OUT} out per million tokens.
${rows.length} items from ${new Set(rows.map((row) => row.source)).size} sources; ${rows.filter((row) => row.has_content).length} with extracted text, the rest with the feed excerpt; ${results.filter((result) => result.truncated && result.variant === 'adaptive').length} cut at the input cap.

| Variant | Runs | OK | Refusals | Fallbacks | Errors | Median in | Median out | Median ms | Per 1,000 cards | Spent | tldr > 30 words | Not 3 points |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${table}

## Samples

${samples}
`

mkdirSync(args.out, { recursive: true })
const file = join(args.out, 'readar-summary-spike.md')
writeFileSync(file, report)
console.log(`\n${table}\n\nReport: ${file}`)
