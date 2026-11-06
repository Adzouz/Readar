// Google News RSS links point at news.google.com/rss/articles/<id>, not the article.
// Older ids embed the URL in base64; newer ones (prefix AU_yqL) need a signed lookup.
// Any failure keeps the wrapper link: it still redirects in a browser.

import { get, HTML_ACCEPT } from './http.ts'

export const isGoogleNewsLink = (url: string): boolean =>
  /^https:\/\/news\.google\.com\/(rss\/)?articles\//.test(url)

function articleId(url: string): string | null {
  const match = /\/articles\/([^?/#]+)/.exec(url)
  return match?.[1] ?? null
}

/** Decodes ids that carry the URL directly (pre-2024 format). */
export function decodeLegacyId(id: string): string | null {
  let bytes: Buffer
  try {
    bytes = Buffer.from(id.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  } catch {
    return null
  }
  const text = bytes.toString('latin1')
  if (text.includes('AU_yqL')) return null
  const match = /https?:\/\/[\x21-\x7e]+/.exec(text)
  if (!match) return null
  return match[0]
}

async function decodeSigned(id: string): Promise<string | null> {
  const page = await get(`https://news.google.com/rss/articles/${id}`, { accept: HTML_ACCEPT })
  const signature = /data-n-a-sg="([^"]+)"/.exec(page.body)?.[1]
  const timestamp = /data-n-a-ts="([^"]+)"/.exec(page.body)?.[1]
  if (!signature || !timestamp) return null
  const inner = JSON.stringify([
    'garturlreq',
    [
      [
        'X',
        'X',
        ['X', 'X'],
        null,
        null,
        1,
        1,
        'US:en',
        null,
        1,
        null,
        null,
        null,
        null,
        null,
        0,
        1,
      ],
      'X',
      'X',
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0,
    ],
    id,
    Number(timestamp),
    signature,
  ])
  const request = JSON.stringify([[['Fbv4je', inner, null, 'generic']]])
  const response = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `f.req=${encodeURIComponent(request)}`,
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) return null
  const body = await response.text()
  const chunk = body.split('\n\n')[1]
  if (!chunk) return null
  const outer: unknown = JSON.parse(chunk)
  const payload = Array.isArray(outer) && Array.isArray(outer[0]) ? outer[0][2] : null
  if (typeof payload !== 'string') return null
  const decoded: unknown = JSON.parse(payload)
  const url = Array.isArray(decoded) ? decoded[1] : null
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null
}

/** The article URL behind a Google News link, or null when it can't be decoded. */
export async function decodeGoogleNewsLink(url: string): Promise<string | null> {
  const id = articleId(url)
  if (!id) return null
  try {
    return decodeLegacyId(id) ?? (await decodeSigned(id))
  } catch {
    return null
  }
}
