// YouTube channel feeds have had intermittent 404s since Dec 2025. When one fails and a Data
// API key is set, read the channel's uploads playlist instead (1 quota unit per call).

import { optional } from './env.ts'
import type { Entry } from './parse.ts'

export const channelIdOf = (feedUrl: string): string | null =>
  /[?&]channel_id=(UC[\w-]{22})/.exec(feedUrl)?.[1] ?? null

interface PlaylistItem {
  snippet?: {
    title?: string
    description?: string
    publishedAt?: string
    channelTitle?: string
    resourceId?: { videoId?: string }
    thumbnails?: Record<string, { url?: string }>
  }
}

/** Latest uploads through the Data API, or null when no key is configured. */
export async function uploadsFromApi(channelId: string): Promise<Entry[] | null> {
  const key = optional('YOUTUBE_API_KEY')
  if (!key) return null
  const playlist = `UU${channelId.slice(2)}`
  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
  url.search = new URLSearchParams({
    part: 'snippet',
    maxResults: '15',
    playlistId: playlist,
    key,
  }).toString()
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`YouTube Data API ${response.status}`)
  const data = (await response.json()) as { items?: PlaylistItem[] }
  return (data.items ?? []).flatMap((item): Entry[] => {
    const snippet = item.snippet
    const videoId = snippet?.resourceId?.videoId
    if (!snippet || !videoId || !snippet.title) return []
    const thumbs = snippet.thumbnails ?? {}
    return [
      {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: snippet.title,
        author: snippet.channelTitle ?? null,
        publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : null,
        excerpt: snippet.description?.slice(0, 600) || null,
        fullText: null,
        imageUrl: thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? null,
        type: 'video',
        publisher: null,
        durationSeconds: null,
      },
    ]
  })
}
