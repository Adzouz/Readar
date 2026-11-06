export type ContentType = 'article' | 'video' | 'thread' | 'podcast'
export type Action = 'like' | 'nope' | 'later'
export type ListId = 'liked' | 'later' | 'dismissed'

export interface Topic {
  id: string
  name: string
  shortName?: string
  emoji: string
  /** Signature color of the topic (icons, rings, accents). */
  hue: string
  /** Custom topic built from a keyword watch rather than the catalog. */
  keyword?: boolean
}

export interface Item {
  id: string
  topicId: string
  type: ContentType
  source: string
  url: string
  age: string
  length: string
  title: string
  tldr: string
  points: string[]
  why: string
  /** Relevance shown as signal strength, 1 (low) to 3 (strong). */
  signal: 1 | 2 | 3
  alsoCoveredBy: number
  /** Two colors for the generated thumbnail. */
  colors: [string, string]
}

export type View = { kind: 'topic'; id: string } | { kind: 'list'; id: ListId }

export const LIST_FOR_ACTION: Record<Action, ListId> = {
  like: 'liked',
  later: 'later',
  nope: 'dismissed',
}
