import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CATALOG, keywordSources, type CatalogSource } from '@/data/catalog'
import type { Topic } from '@/deck/types'

export type SetupStep = 'style' | 'topics' | 'sources' | 'done'

/** A custom topic built from a keyword the user wants to watch. */
export interface KeywordTopic {
  id: string
  keyword: string
}

/** A link the user added to a topic. The fetch worker finds its feed (Phase 1). */
export interface UserSource {
  id: string
  topicId: string
  url: string
}

export interface SetupState {
  step: SetupStep
  /** True once onboarding finished; later visits to the steps are edits. */
  completed: boolean
  /** Catalog topics the user follows, in the order picked. */
  topicIds: string[]
  keywords: KeywordTopic[]
  /** Suggested sources the user switched off. */
  disabledSourceIds: string[]
  userSources: UserSource[]
  goTo: (step: SetupStep) => void
  finish: () => void
  toggleTopic: (id: string) => void
  /** Returns false when the keyword is empty or already watched. */
  addKeyword: (keyword: string) => boolean
  removeKeyword: (id: string) => void
  toggleSource: (id: string) => void
  /** Returns false when the input isn't a usable link. */
  addUserSource: (topicId: string, input: string) => boolean
  removeUserSource: (id: string) => void
}

export const KEYWORD_HUE = '#7A5AF8'

export const keywordTopicId = (keyword: string): string =>
  `kw-${keyword
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')}`

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

const toggle = (list: string[], id: string): string[] =>
  list.includes(id) ? list.filter((item) => item !== id) : [...list, id]

type PersistedSetup = Pick<
  SetupState,
  'step' | 'completed' | 'topicIds' | 'keywords' | 'disabledSourceIds' | 'userSources'
>

export const useSetup = create<SetupState>()(
  persist(
    (set, get) => ({
      step: 'style',
      completed: false,
      topicIds: [],
      keywords: [],
      disabledSourceIds: [],
      userSources: [],

      goTo: (step) => set({ step }),
      finish: () => set({ step: 'done', completed: true }),
      toggleTopic: (id) => set((state) => ({ topicIds: toggle(state.topicIds, id) })),

      addKeyword: (input) => {
        const keyword = input.trim().replace(/\s+/g, ' ')
        const id = keywordTopicId(keyword)
        if (id === 'kw-' || get().keywords.some((existing) => existing.id === id)) return false
        set((state) => ({ keywords: [...state.keywords, { id, keyword }] }))
        return true
      },

      removeKeyword: (id) =>
        set((state) => ({
          keywords: state.keywords.filter((keyword) => keyword.id !== id),
          userSources: state.userSources.filter((source) => source.topicId !== id),
        })),

      toggleSource: (id) =>
        set((state) => ({ disabledSourceIds: toggle(state.disabledSourceIds, id) })),

      addUserSource: (topicId, input) => {
        const url = normalizeUrl(input)
        if (!url) return false
        const id = `user:${topicId}:${url}`
        if (get().userSources.some((source) => source.id === id)) return true
        set((state) => ({ userSources: [...state.userSources, { id, topicId, url }] }))
        return true
      },

      removeUserSource: (id) =>
        set((state) => ({ userSources: state.userSources.filter((source) => source.id !== id) })),
    }),
    {
      name: 'readar.setup',
      partialize: ({
        step,
        completed,
        topicIds,
        keywords,
        disabledSourceIds,
        userSources,
      }): PersistedSetup => ({
        step,
        completed,
        topicIds,
        keywords,
        disabledSourceIds,
        userSources,
      }),
      // Someone who quit while editing their topics reopens on their deck, not mid-edit.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedSetup>
        return {
          ...current,
          ...saved,
          step: saved.completed ? 'done' : (saved.step ?? current.step),
        }
      },
    },
  ),
)

/** Topics the user follows: catalog topics in the order picked, then keyword watches. */
export function followedTopics(state: Pick<SetupState, 'topicIds' | 'keywords'>): Topic[] {
  const fromCatalog = state.topicIds.flatMap((id): Topic[] => {
    const topic = CATALOG.find((entry) => entry.id === id)
    if (!topic) return []
    const { name, shortName, emoji, hue } = topic
    return [{ id, name, shortName, emoji, hue }]
  })
  const watches = state.keywords.map((watch): Topic => ({
    id: watch.id,
    name: `“${watch.keyword}”`,
    shortName: watch.keyword,
    emoji: '🔎',
    hue: KEYWORD_HUE,
    keyword: true,
  }))
  return [...fromCatalog, ...watches]
}

/** Sources Readar suggests for a topic: the catalog's, or news and Hacker News searches. */
export function suggestedSources(topicId: string, keywords: KeywordTopic[]): CatalogSource[] {
  const topic = CATALOG.find((entry) => entry.id === topicId)
  if (topic) return topic.sources
  const watch = keywords.find((entry) => entry.id === topicId)
  return watch ? keywordSources(watch.keyword) : []
}

/** How many sources will be read for a topic: suggestions left on plus the user's links. */
export function activeSourceCount(
  state: Pick<SetupState, 'keywords' | 'disabledSourceIds' | 'userSources'>,
  topicId: string,
): number {
  const suggested = suggestedSources(topicId, state.keywords).filter(
    (source) => !state.disabledSourceIds.includes(source.id),
  ).length
  return suggested + state.userSources.filter((source) => source.topicId === topicId).length
}
