import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { get, HTML_ACCEPT, robotsAllow } from './http.ts'
import { readingMinutes } from './text.ts'

export interface Extracted {
  text: string
  excerpt: string | null
  imageUrl: string | null
  language: string | null
  readingMinutes: number
}

/** Reads the article behind a link with Readability. Null when blocked, not HTML or empty. */
export async function extractArticle(url: string): Promise<Extracted | null> {
  if (!(await robotsAllow(url))) return null
  const response = await get(url, { accept: HTML_ACCEPT })
  const type = response.headers.get('content-type') ?? ''
  if (response.status !== 200 || !/html/i.test(type)) return null
  return extractFromHtml(response.body, response.url)
}

export function extractFromHtml(html: string, url: string): Extracted | null {
  const { document } = parseHTML(html)
  const meta = (selector: string): string | null =>
    document.querySelector(selector)?.getAttribute('content')?.trim() || null
  const imageUrl = meta('meta[property="og:image"]') ?? meta('meta[name="twitter:image"]')
  const language = document.documentElement?.getAttribute('lang')?.slice(0, 2).toLowerCase() || null
  // linkedom's document has no URL; Readability uses it to resolve relative links.
  Object.defineProperty(document, 'documentURI', { value: url })
  const article = new Readability(document as unknown as Document).parse()
  const text = article?.textContent?.replace(/\s+/g, ' ').trim()
  if (!text || text.length < 200) return null
  return {
    text,
    excerpt: article?.excerpt?.trim() || null,
    imageUrl: imageUrl ? safeUrl(imageUrl, url) : null,
    language,
    readingMinutes: readingMinutes(text),
  }
}

const safeUrl = (value: string, base: string): string | null => {
  try {
    const resolved = new URL(value, base)
    return resolved.protocol === 'https:' || resolved.protocol === 'http:' ? resolved.href : null
  } catch {
    return null
  }
}
