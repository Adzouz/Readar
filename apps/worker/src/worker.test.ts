import { describe, expect, it } from 'vitest'
import { allowedBy, blockedByFirewall, isPrivateAddress, parseRobots } from './http.ts'
import { looksLikeFeed, parseEntries } from './parse.ts'
import { decodeEntities, readingMinutes, textFromHtml } from './text.ts'

const RSS = `<?xml version="1.0"?>
<?xml-stylesheet href="/style.xsl" type="text/xsl"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>Example &amp; Co</title>
<item>
  <title>First &#8216;post&#8217;</title>
  <link>/posts/1</link>
  <description><![CDATA[<p>Hello <b>world</b></p>]]></description>
  <pubDate>Thu, 05 Nov 2026 10:00:00 GMT</pubDate>
  <enclosure url="https://example.com/a.mp3" type="audio/mpeg" length="1"/>
</item>
<item><title>No link</title></item>
</channel></rss>`

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title>
<entry><title>Video</title><link rel="alternate" href="https://www.youtube.com/watch?v=abc"/>
<published>2026-11-06T07:00:00Z</published><author><name>Chan</name></author></entry></feed>`

describe('parseEntries', () => {
  it('normalizes RSS items and resolves relative links', () => {
    const { title, entries } = parseEntries(RSS, 'feed', 'https://example.com/feed.xml')
    expect(title).toBe('Example & Co')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      url: 'https://example.com/posts/1',
      title: 'First ‘post’',
      excerpt: 'Hello world',
      type: 'podcast',
    })
    expect(entries[0]?.publishedAt?.toISOString()).toBe('2026-11-05T10:00:00.000Z')
  })

  it('drops entries whose link is not http(s)', () => {
    const feed = `<rss version="2.0"><channel><title>Bad</title>
<item><title>Script</title><link>javascript:alert(document.cookie)</link></item>
<item><title>Data</title><link>data:text/html,&lt;script&gt;x()&lt;/script&gt;</link></item>
<item><title>Fine</title><link>https://example.com/ok</link></item>
</channel></rss>`
    const { entries } = parseEntries(feed, 'feed', 'https://example.com/feed.xml')
    expect(entries.map((entry) => entry.url)).toEqual(['https://example.com/ok'])
  })

  it('reads Atom entries and spots videos', () => {
    const [entry] = parseEntries(ATOM, 'feed', 'https://example.com/').entries
    expect(entry).toMatchObject({ type: 'video', author: 'Chan', title: 'Video' })
  })

  it('tells feeds from pages', () => {
    expect(looksLikeFeed(RSS)).toBe(true)
    expect(looksLikeFeed(ATOM)).toBe(true)
    expect(looksLikeFeed('<!doctype html><html><head></head></html>')).toBe(false)
  })
})

describe('robots.txt', () => {
  const rules = parseRobots(`
User-agent: *
Disallow: /private
Allow: /private/ok

User-agent: OtherBot
Disallow: /
`)

  it('applies the longest matching rule', () => {
    expect(allowedBy(rules, '/blog/post')).toBe(true)
    expect(allowedBy(rules, '/private/secret')).toBe(false)
    expect(allowedBy(rules, '/private/ok/page')).toBe(true)
  })

  it('prefers a group naming our agent', () => {
    const mine = parseRobots(
      'User-agent: *\nDisallow:\n\nUser-agent: Readar\nDisallow: /',
      'readar',
    )
    expect(allowedBy(mine, '/anything')).toBe(false)
  })
})

describe('text', () => {
  it('strips tags and decodes entities', () => {
    expect(textFromHtml('<p>A&nbsp;&amp;&#x20AC;</p><script>x()</script><p>B</p>')).toBe('A &€ B')
    expect(decodeEntities('&unknown;')).toBe('&unknown;')
  })

  it('estimates reading time', () => {
    expect(readingMinutes('word '.repeat(460))).toBe(2)
    expect(readingMinutes('')).toBe(1)
  })
})

describe('blockedByFirewall', () => {
  const response = (status: number, headers: Record<string, string>, body = '') => ({
    status,
    headers: new Headers(headers),
    body,
  })

  it('spots bot challenges and firewall pages', () => {
    expect(blockedByFirewall(response(403, { 'cf-mitigated': 'challenge' }))).toBe(true)
    expect(blockedByFirewall(response(503, { server: 'cloudflare' }))).toBe(true)
    expect(blockedByFirewall(response(403, {}, '<title>Just a moment...</title>'))).toBe(true)
  })

  it('leaves plain errors alone', () => {
    expect(blockedByFirewall(response(403, { server: 'nginx' }, 'Forbidden'))).toBe(false)
    expect(blockedByFirewall(response(404, { server: 'cloudflare' }))).toBe(false)
  })
})

describe('isPrivateAddress', () => {
  it('blocks loopback, private ranges, cloud metadata and IPv6 local addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.1',
      '192.168.1.10',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
  })

  it('lets public addresses through', () => {
    for (const ip of ['185.199.108.153', '8.8.8.8', '172.32.0.1', '2606:4700::6810:84e5']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })
})
