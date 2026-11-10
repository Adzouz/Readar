import { isWebUrl } from '@readar/core'
import type { Item, Topic } from '@/deck/types'
import type { ItemCardRow } from '@/lib/database'

// Thumbnail gradients for real items, picked by source so a source keeps its look.
const PALETTE: [string, string][] = [
  ['#FFB17A', '#B9A7FF'],
  ['#5ED6C8', '#6A78FF'],
  ['#8AB4FF', '#C6A2FF'],
  ['#8C9BFF', '#FFB38A'],
  ['#9BE7B8', '#5B8CFF'],
  ['#B6A4FF', '#7FD0FF'],
  ['#C7B6FF', '#FFC2A1'],
  ['#FF9AA8', '#FFD08A'],
  ['#FFC46B', '#FF7E95'],
  ['#FFC9A0', '#8FD3FF'],
  ['#FFD27A', '#7FA6FF'],
  ['#7FD8C9', '#6C7BFF'],
]

const hash = (value: string): number => {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** "now", "12m", "3h", "2d", "5w", then a short date. */
export function ageOf(iso: string | null, now = Date.now()): string {
  if (!iso) return ''
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (Number.isNaN(minutes)) return ''
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d`
  if (days < 35) return `${Math.round(days / 7)}w`
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function lengthOf(row: ItemCardRow): string {
  const minutes = row.reading_minutes
  if (!minutes) return ''
  return row.content_type === 'article' || row.content_type === 'thread'
    ? `${minutes} min read`
    : `${minutes} min`
}

const NO_PREVIEW = 'No preview from the source yet. Open the original to read it.'

/**
 * A card from a Supabase row, or null when its link isn't http(s): such a card is never shown or
 * opened. Summaries replace the excerpt once Claude is connected.
 */
export function toItem(
  row: ItemCardRow,
  topic: Pick<Topic, 'id' | 'name'>,
  now = Date.now(),
): Item | null {
  if (!isWebUrl(row.url)) return null
  const source = row.source_name ?? new URL(row.url).hostname.replace(/^www\./, '')
  return {
    id: row.id,
    topicId: topic.id,
    type: row.content_type,
    source,
    url: row.url,
    age: ageOf(row.published_at, now),
    length: lengthOf(row),
    title: row.title,
    excerpt: row.excerpt ?? NO_PREVIEW,
    why: `Matches: ${topic.name}`,
    signal: 2,
    alsoCoveredBy: Math.max(0, row.coverage - 1),
    colors: PALETTE[hash(source) % PALETTE.length] ?? ['#FFB17A', '#B9A7FF'],
  }
}
