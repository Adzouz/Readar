import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  CATALOG,
  keywordSources,
  keywordTopicId,
  normalizeUrl,
  type CatalogSource,
} from '@readar/core'
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
  /** The topic whose Sources button opened the sources screen: Back returns to it. Not saved. */
  sourcesFrom: string | null
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

export { keywordTopicId, normalizeUrl }

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
      sourcesFrom: null,

      goTo: (step) => set({ step, sourcesFrom: null }),
      finish: () => set({ step: 'done', completed: true, sourcesFrom: null }),
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

/** The sources read for a topic: ids of suggestions left on, then the URLs of the user's links. */
export function activeSourceIds(
  state: Pick<SetupState, 'keywords' | 'disabledSourceIds' | 'userSources'>,
  topicId: string,
): string[] {
  const suggested = suggestedSources(topicId, state.keywords)
    .filter((source) => !state.disabledSourceIds.includes(source.id))
    .map((source) => source.id)
  const links = state.userSources
    .filter((source) => source.topicId === topicId)
    .map((source) => source.url)
  return [...suggested, ...links]
}

/** How many sources will be read for a topic: suggestions left on plus the user's links. */
export const activeSourceCount = (
  state: Pick<SetupState, 'keywords' | 'disabledSourceIds' | 'userSources'>,
  topicId: string,
): number => activeSourceIds(state, topicId).length

/** Opens the sources screen at one topic, from that topic's view. Back returns to the topic. */
export function openSources(topicId: string): void {
  useSetup.setState({ step: 'sources', sourcesFrom: topicId })
}
