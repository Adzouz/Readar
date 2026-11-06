// URL helpers shared by the client and the worker. No Node or DOM APIs beyond URL.

/** Query parameters that only track where a click came from. */
const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'yclid',
  '_hsenc',
  '_hsmi',
  'mkt_tok',
  'ref',
  'ref_src',
  'ref_url',
  'cmpid',
  'ncid',
  'sr_share',
  'guccounter',
])

const isTracking = (name: string): boolean => {
  const lower = name.toLowerCase()
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower)
}

/**
 * The form of a link used to spot the same article from two sources: https, lower-case host
 * without `www.`, no fragment, no tracking parameters, sorted query, no trailing slash.
 * Returns null for anything that isn't an http(s) URL.
 */
export function canonicalUrl(input: string, base?: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim(), base)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  url.protocol = 'https:'
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  url.hash = ''
  url.username = ''
  url.password = ''
  if (url.port === '80' || url.port === '443') url.port = ''
  const kept = [...url.searchParams].filter(([name]) => !isTracking(name))
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  url.search = new URLSearchParams(kept).toString()
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }
  return url.href
}

/** Turns what the user typed into an http(s) link, adding https:// when missing. */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed || /\s/.test(trimmed)) return null
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!url.hostname.includes('.')) return null
    return url.href
  } catch {
    return null
  }
}

/** Id of the custom topic that watches a keyword, e.g. `kw-claude-code`. */
export const keywordTopicId = (keyword: string): string =>
  `kw-${keyword
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')}`
