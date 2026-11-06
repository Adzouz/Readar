// Polite HTTP for the worker: one identifiable user agent, timeouts, robots.txt for pages.

export const USER_AGENT = 'Readar/0.1 (+https://github.com/Adzouz/Readar; feed reader)'
const ROBOTS_AGENT = 'readar'
const TIMEOUT_MS = 20_000
/** Bodies larger than this are cut off: feeds and articles never need more. */
const MAX_BYTES = 5 * 1024 * 1024

export interface FetchResult {
  status: number
  url: string
  headers: Headers
  body: string
}

export async function get(
  url: string,
  options: { accept?: string; headers?: Record<string, string> } = {},
): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: options.accept ?? '*/*',
      ...options.headers,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = response.status === 304 ? '' : await readCapped(response)
  return { status: response.status, url: response.url || url, headers: response.headers, body }
}

async function readCapped(response: Response): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel()
      break
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

export const FEED_ACCEPT =
  'application/rss+xml, application/atom+xml, application/feed+json, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8'
export const HTML_ACCEPT = 'text/html, application/xhtml+xml;q=0.9, */*;q=0.5'

// --- robots.txt -------------------------------------------------------------------------------

interface Rules {
  allow: string[]
  disallow: string[]
}

const robotsCache = new Map<string, { rules: Rules; until: number }>()
const ROBOTS_TTL_MS = 6 * 60 * 60 * 1000

/** Rules for our agent (or `*`) from a robots.txt body. */
export function parseRobots(body: string, agent = ROBOTS_AGENT): Rules {
  const groups: { agents: string[]; rules: Rules }[] = []
  let current: { agents: string[]; rules: Rules } | null = null
  let lastWasAgent = false
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim()
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line)
    if (!match) continue
    const key = (match[1] ?? '').toLowerCase()
    const value = (match[2] ?? '').trim()
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: { allow: [], disallow: [] } }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!current) continue
    if (key === 'allow' && value) current.rules.allow.push(value)
    if (key === 'disallow' && value) current.rules.disallow.push(value)
  }
  const mine = groups.find((group) => group.agents.some((a) => a !== '*' && agent.includes(a)))
  const any = groups.find((group) => group.agents.includes('*'))
  return (mine ?? any)?.rules ?? { allow: [], disallow: [] }
}

const toRegExp = (pattern: string): RegExp =>
  new RegExp(
    `^${pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\\\$$/, '$')}`,
  )

/** Longest matching rule wins; Allow wins ties (Google's reading of the spec). */
export function allowedBy(rules: Rules, path: string): boolean {
  let best = { length: -1, allow: true }
  for (const [list, allow] of [
    [rules.allow, true],
    [rules.disallow, false],
  ] as const) {
    for (const pattern of list) {
      if (toRegExp(pattern).test(path) && pattern.length >= best.length) {
        if (pattern.length > best.length || allow) best = { length: pattern.length, allow }
      }
    }
  }
  return best.allow
}

/** Whether robots.txt lets us fetch this page. Unreachable robots.txt means allowed. */
export async function robotsAllow(url: string): Promise<boolean> {
  const target = new URL(url)
  const cached = robotsCache.get(target.origin)
  let rules = cached && cached.until > Date.now() ? cached.rules : null
  if (!rules) {
    try {
      const response = await get(`${target.origin}/robots.txt`, { accept: 'text/plain' })
      rules =
        response.status >= 200 && response.status < 300
          ? parseRobots(response.body)
          : { allow: [], disallow: [] }
    } catch {
      rules = { allow: [], disallow: [] }
    }
    robotsCache.set(target.origin, { rules, until: Date.now() + ROBOTS_TTL_MS })
  }
  return allowedBy(rules, target.pathname + target.search)
}
