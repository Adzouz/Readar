// Polite HTTP for the worker: one identifiable user agent, timeouts, robots.txt for pages.
// Safe for links anyone can add: only public web addresses, checked again at every redirect.

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export const USER_AGENT = 'Readar/0.1 (+https://github.com/Adzouz/Readar; feed reader)'
const ROBOTS_AGENT = 'readar'
const TIMEOUT_MS = 20_000
/** Bodies larger than this are cut off: feeds and articles never need more. */
const MAX_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 5

const v4 = (ip: string) => ip.split('.').map(Number) as [number, number, number, number]

function privateV4(ip: string): boolean {
  const [a, b] = v4(ip)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

/** The eight 16-bit groups of an IPv6 address, with `::` and a dotted IPv4 tail expanded. */
function groups6(ip: string): number[] | null {
  let text = ip.toLowerCase().replace(/%.*$/, '') // drop a zone id (fe80::1%en0)
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(text)?.[1]
  if (tail) {
    const [a, b, c, d] = v4(tail)
    text =
      text.slice(0, -tail.length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const [head = '', rest] = text.split('::')
  const left = head ? head.split(':') : []
  const right = rest ? rest.split(':') : []
  const fill = rest === undefined ? [] : Array<string>(8 - left.length - right.length).fill('0')
  const all = [...left, ...fill, ...right].map((group) => parseInt(group, 16))
  return all.length === 8 && all.every((group) => group >= 0 && group <= 0xffff) ? all : null
}

const fromGroups = (high: number, low: number) =>
  `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`

/**
 * Loopback, private, link-local (cloud metadata), carrier-grade NAT, multicast, reserved, in
 * IPv4 and IPv6, including IPv6 forms that carry an IPv4 address (mapped `::ffff:7f00:1`,
 * NAT64, 6to4), whatever way they are written.
 */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return privateV4(ip)
  const g = groups6(ip)
  if (!g) return true // not an address we understand: refuse
  const [g0 = 0, g1 = 0, g2 = 0, , , g5 = 0, g6 = 0, g7 = 0] = g
  const zeros = (count: number) => g.slice(0, count).every((group) => group === 0)
  // ::a.b.c.d (also :: and ::1) and ::ffff:a.b.c.d
  if (zeros(5) && (g5 === 0 || g5 === 0xffff)) return privateV4(fromGroups(g6, g7))
  // NAT64 64:ff9b::/96
  if (g0 === 0x64 && g1 === 0xff9b && g.slice(2, 6).every((group) => group === 0)) {
    return privateV4(fromGroups(g6, g7))
  }
  // 6to4 2002:AABB:CCDD::/48
  if (g0 === 0x2002) return privateV4(fromGroups(g1, g2))
  return (
    (g0 & 0xfe00) === 0xfc00 || // unique local
    (g0 & 0xffc0) === 0xfe80 || // link-local
    (g0 & 0xffc0) === 0xfec0 || // old site-local
    (g0 & 0xff00) === 0xff00 || // multicast
    (g0 === 0x2001 && g1 === 0) // Teredo
  )
}

/** Throws unless the URL is http(s) on a host that only resolves to public addresses. */
async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Not a web address')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((entry) => entry.address)
  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw new Error('Private address: not a public website')
  }
}

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
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  let current = new URL(url)
  // Redirects are followed by hand so each hop is checked: a public page can't bounce the
  // worker to a private address.
  for (let hop = 0; ; hop += 1) {
    await assertPublic(current)
    const response = await fetch(current, {
      headers: {
        'user-agent': USER_AGENT,
        accept: options.accept ?? '*/*',
        ...options.headers,
      },
      redirect: 'manual',
      signal,
    })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && response.status !== 304 && location) {
      await response.body?.cancel()
      if (hop >= MAX_REDIRECTS) throw new Error('Too many redirects')
      current = new URL(location, current)
      continue
    }
    const body = response.status === 304 ? '' : await readCapped(response)
    return { status: response.status, url: current.href, headers: response.headers, body }
  }
}

/**
 * A bot challenge or firewall page (Cloudflare, Akamai, Sucuri…) rather than a plain refusal:
 * the site lets browsers in but not feed readers.
 */
export function blockedByFirewall(response: Pick<FetchResult, 'status' | 'headers' | 'body'>) {
  if (![401, 403, 429, 503].includes(response.status)) return false
  if (response.headers.get('cf-mitigated')) return true
  const server = response.headers.get('server') ?? ''
  const page = response.body.slice(0, 20_000)
  return (
    /cloudflare|akamai|sucuri|imperva|incapsula|ddos-guard/i.test(server) ||
    /just a moment|attention required|cf-chl|captcha|ddos protection|access denied/i.test(page)
  )
}

/** The error for a response that isn't a 200, with "(firewall)" when a firewall stopped us. */
export function httpError(response: Pick<FetchResult, 'status' | 'headers' | 'body'>): Error {
  return new Error(`HTTP ${response.status}${blockedByFirewall(response) ? ' (firewall)' : ''}`)
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
