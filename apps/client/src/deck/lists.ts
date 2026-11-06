import { Clock, Heart, X, type LucideIcon } from 'lucide-react'
import type { Action, ContentType, ListId } from './types'

export interface ListMeta {
  id: ListId
  name: string
  Icon: LucideIcon
  /** Text color class for the list's icon. */
  tone: string
  empty: string
}

export const LIST_META: Record<ListId, ListMeta> = {
  liked: {
    id: 'liked',
    name: 'Liked',
    Icon: Heart,
    tone: 'text-like',
    empty: 'Swipe right or press → on a card to like it.',
  },
  later: {
    id: 'later',
    name: 'Read later',
    Icon: Clock,
    tone: 'text-later',
    empty: 'Swipe up or press ↑ to save a card for later.',
  },
  dismissed: {
    id: 'dismissed',
    name: 'Dismissed',
    Icon: X,
    tone: 'text-nope',
    empty: 'Swipe left or press ← to dismiss. You can restore cards from here.',
  },
}

export const LISTS: ListMeta[] = [LIST_META.liked, LIST_META.later, LIST_META.dismissed]

export const DONE_LABEL: Record<Action, string> = {
  like: 'Liked',
  later: 'Saved for later',
  nope: 'Dismissed',
}

export const TYPE_LABEL: Record<ContentType, string> = {
  article: 'Article',
  video: 'Video',
  thread: 'Thread',
  podcast: 'Podcast',
}
