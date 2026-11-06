import type { ContentType } from '@readar/core'
import { parseFeed } from 'feedsmith'
import { textFromHtml } from './text.ts'

/** One feed entry, normalized across RSS, Atom, RDF and JSON Feed. */
export interface Entry {
  url: string
  title: string
  author: string | null
  publishedAt: Date | null
  /** Plain-text excerpt from the feed (description or summary), trimmed. */
  excerpt: string | null
  /** Plain text of the full article when the feed carries it. */
  fullText: string | null
  imageUrl: string | null
  type: ContentType
  /** Who published it, for search feeds that mix many sites (Google News). */
  publisher: string | null
  durationSeconds: number | null
}

export interface ParsedFeed {
  title: string | null
  entries: Entry[]
}

// The subset of feedsmith's item shapes we read. Every field is optional in practice.
interface Text {
  value?: string
}
interface Link {
  href?: string
  rel?: string
  type?: string
}
interface MediaGroup {
  thumbnails?: { url?: string }[]
  description?: Text
}
interface LooseItem {
  title?: string | Text
  link?: string
  links?: Link[]
  url?: string
  id?: string
  guid?: { value?: string; isPermaLink?: boolean }
  description?: string
  summary?: string | Text
  content?: Text | { encoded?: string }
  content_html?: string
  content_text?: string
  pubDate?: string
  published?: string
  updated?: string
  date_published?: string
  author?: string | { name?: string }
  authors?: { name?: string }[]
  dc?: { creators?: string[]; creator?: string; date?: string; dates?: string[] }
  source?: { title?: string; url?: string }
  enclosures?: { url?: string; type?: string }[]
  image?: string
  itunes?: { duration?: number; image?: string }
  media?: { groups?: MediaGroup[]; thumbnails?: { url?: string }[] }
}
interface LooseFeed {
  title?: string | Text
  items?: LooseItem[]
  entries?: LooseItem[]
}

const EXCERPT_CHARS = 600
/** A feed body longer than this (in words) counts as the full article. */
const FULL_TEXT_WORDS = 250

const text = (value: string | Text | undefined): string | null => {
  const raw = typeof value === 'string' ? value : value?.value
  const clean = raw ? textFromHtml(raw) : ''
  return clean || null
}

const clip = (value: string | null): string | null => {
  if (!value) return null
  if (value.length <= EXCERPT_CHARS) return value
  const cut = value.slice(0, EXCERPT_CHARS)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), EXCERPT_CHARS - 40)).trimEnd()}…`
}

const date = (...values: (string | undefined)[]): Date | null => {
  for (const value of values) {
    if (!value) continue
    const time = Date.parse(value)
    if (!Number.isNaN(time)) return new Date(time)
  }
  return null
}

function link(item: LooseItem): string | null {
  if (item.link) return item.link
  if (item.url) return item.url
  const links = item.links ?? []
  const alternate = links.find((l) => !l.rel || l.rel === 'alternate') ?? links[0]
  if (alternate?.href) return alternate.href
  if (item.guid?.value && item.guid.isPermaLink !== false && /^https?:/.test(item.guid.value)) {
    return item.guid.value
  }
  if (item.id && /^https?:/.test(item.id)) return item.id
  return null
}

function bodyHtml(item: LooseItem): string | undefined {
  const content = item.content
  if (content && 'encoded' in content && content.encoded) return content.encoded
  if (content && 'value' in content && content.value) return content.value
  return item.content_html ?? item.content_text
}

function author(item: LooseItem): string | null {
  if (typeof item.author === 'string') return item.author || null
  return (
    item.author?.name ??
    item.authors?.[0]?.name ??
    item.dc?.creators?.[0] ??
    item.dc?.creator ??
    null
  )
}

function image(item: LooseItem): string | null {
  const group = item.media?.groups?.[0]
  return (
    group?.thumbnails?.[0]?.url ??
    item.media?.thumbnails?.[0]?.url ??
    item.enclosures?.find((e) => e.type?.startsWith('image/'))?.url ??
    item.itunes?.image ??
    item.image ??
    null
  )
}

function typeOf(item: LooseItem, url: string, sourceKind: string): ContentType {
  if (sourceKind === 'youtube' || /youtube\.com\/watch|youtu\.be\//.test(url)) return 'video'
  if (sourceKind === 'podcast' || item.enclosures?.some((e) => e.type?.startsWith('audio/'))) {
    return 'podcast'
  }
  if (/news\.ycombinator\.com\/item/.test(url)) return 'thread'
  return 'article'
}

/** Parses an RSS, Atom, RDF or JSON feed. Throws when the body isn't a feed. */
export function parseEntries(body: string, sourceKind: string, baseUrl: string): ParsedFeed {
  const { feed } = parseFeed(body) as { feed: LooseFeed }
  const items = feed.items ?? feed.entries ?? []
  const entries: Entry[] = []
  for (const item of items) {
    const raw = link(item)
    if (!raw) continue
    let url: string
    try {
      url = new URL(raw, baseUrl).href
    } catch {
      continue
    }
    const title = text(item.title)
    if (!title) continue
    const fullBody = text(bodyHtml(item))
    const summary =
      text(item.summary) ?? text(item.description) ?? text(item.media?.groups?.[0]?.description)
    // hnrss and Google News descriptions only repeat the link and title, not an excerpt.
    const noExcerpt = /^https:\/\/(hnrss\.org|news\.google\.com)\//.test(baseUrl)
    entries.push({
      url,
      title,
      author: author(item),
      publishedAt: date(
        item.pubDate,
        item.published,
        item.date_published,
        item.dc?.date,
        item.dc?.dates?.[0],
        item.updated,
      ),
      excerpt: noExcerpt ? null : clip(summary ?? fullBody),
      fullText: fullBody && fullBody.split(/\s+/).length >= FULL_TEXT_WORDS ? fullBody : null,
      imageUrl: image(item),
      type: typeOf(item, url, sourceKind),
      publisher: item.source?.title ?? null,
      durationSeconds: item.itunes?.duration ?? null,
    })
  }
  return { title: text(feed.title), entries }
}

/** Whether a response body looks like a feed rather than a web page. */
export function looksLikeFeed(body: string): boolean {
  const head = body.slice(0, 4096)
  if (/^\s*\{/.test(head)) return /"version"\s*:\s*"https?:\/\/jsonfeed\.org/.test(head)
  return /<(rss|feed|rdf:RDF)[\s>]/i.test(head) && !/<html[\s>]/i.test(head)
}
