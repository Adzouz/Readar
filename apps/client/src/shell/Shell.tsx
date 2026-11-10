import { Clock, LoaderCircle, Rss, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { AHEAD, summarizeAhead, useSummarizeAhead } from '@/claude/summaries'
import { ActionBar } from '@/deck/ActionBar'
import { useDeckActions, type DeckActions } from '@/deck/actions'
import { Deck, type DeckHandle } from '@/deck/Deck'
import { Empty } from '@/deck/Empty'
import { DONE_LABEL } from '@/deck/lists'
import { ListView } from '@/deck/ListView'
import { StageHeader } from '@/deck/StageHeader'
import { deckStore, useDeck } from '@/deck/store'
import { TopicIcon } from '@/deck/TopicIcon'
import type { Action } from '@/deck/types'
import { useDeckKeys } from '@/deck/useDeckKeys'
import { isTauri } from '@/lib/platform'
import { stopSpeaking, useSpeech } from '@/lib/speech'
import { activeSourceCount, activeSourceIds, openSources, useSetup } from '@/onboarding/store'
import { useFetchNow } from '@/sync/fetchNow'
import { troubledCount, useSourceHealth } from '@/sync/sourceHealth'
import { useStyle } from '@/theme/ThemeScope'
import { Bubbles, EditionHeader, GlassSidebar, TopicStrip } from './nav'
import { Settings } from './Settings'
import { Toast, useToast } from './toast'

const NO_ITEMS: string[] = []

/** The app layout. Navigation differs per style; the stage and its features are shared. */
export function Shell() {
  const style = useStyle()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const deckRef = useRef<DeckHandle>(null)
  const actions = useDeckActions(deckRef)
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  useDeckKeys(actions, openSettings, !settingsOpen)

  const stage = <Stage deckRef={deckRef} actions={actions} />

  return (
    <>
      {/* Lets the Mac app's window be dragged by its top edge (overlay title bar). */}
      {isTauri() && <div data-tauri-drag-region className="fixed inset-x-0 top-0 z-40 h-8" />}
      {style === 'glass' ? (
        <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[236px_minmax(0,1fr)]">
          <GlassSidebar onSettings={openSettings} />
          <div className="flex min-h-0 min-w-0 flex-col bg-win">
            <TopicStrip onSettings={openSettings} />
            {stage}
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col bg-win">
          {style === 'editorial' ? (
            <EditionHeader onSettings={openSettings} />
          ) : (
            <Bubbles onSettings={openSettings} />
          )}
          {stage}
        </div>
      )}
      <Settings open={settingsOpen} onClose={closeSettings} />
      <Toast />
    </>
  )
}

interface StageProps {
  deckRef: RefObject<DeckHandle | null>
  actions: DeckActions
}

function Stage({ deckRef, actions }: StageProps) {
  const view = useDeck((s) => s.view)
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8 md:pt-10">
      {view.kind === 'list' ? (
        <ListView listId={view.id} />
      ) : (
        <TopicStage key={view.id} topicId={view.id} deckRef={deckRef} actions={actions} />
      )}
    </main>
  )
}

function TopicStage({ topicId, deckRef, actions }: StageProps & { topicId: string }) {
  const topic = useDeck((s) => s.topics.find((t) => t.id === topicId))
  const queue = useDeck((s) => s.queues[topicId] ?? NO_ITEMS)
  const total = useDeck((s) => s.totals[topicId] ?? 0)
  const canUndo = useDeck((s) => s.history.length > 0)
  const sourceCount = useSetup((s) => activeSourceCount(s, topicId))
  const keywords = useSetup((s) => s.keywords)
  const disabledSourceIds = useSetup((s) => s.disabledSourceIds)
  const userSources = useSetup((s) => s.userSources)
  const health = useSourceHealth((s) => s.rows)
  const troubled = troubledCount(
    health,
    topicId,
    activeSourceIds({ keywords, disabledSourceIds, userSources }, topicId),
  )
  const show = useToast((s) => s.show)
  const ahead = useSummarizeAhead((s) => s.ahead)
  const nextIds = queue.slice(0, AHEAD + 1).join(' ')

  // Reading aloud is about the card on top: stop when it changes or the topic closes.
  const topId = queue[0]
  useEffect(() => {
    return () => {
      if (useSpeech.getState().speakingId === topId) stopSpeaking()
    }
  }, [topId])

  // "Summarize ahead": the card on top and the next few, as the deck moves.
  useEffect(() => {
    if (ahead && nextIds) void summarizeAhead(nextIds.split(' '))
  }, [ahead, nextIds])

  const onDecide = useCallback(
    (action: Action) => {
      deckStore.getState().decide(action)
      show(`${DONE_LABEL[action]} · ⌘Z to undo`)
    },
    [show],
  )

  if (!topic) return null
  const remaining = queue.length

  return (
    <>
      <StageHeader
        icon={<TopicIcon topic={topic} size="lg" />}
        title={topic.name}
        subtitle={
          // The count to review sits next to the progress bar on the right.
          remaining
            ? topic.keyword
              ? 'Keyword watch'
              : undefined
            : total
              ? 'All caught up'
              : `${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'} · nothing fetched yet`
        }
        progress={{ done: total - remaining, total }}
        action={
          <button
            type="button"
            onClick={() => openSources(topicId)}
            title="See and edit this topic's sources"
            className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12.5px] text-muted hover:bg-hover hover:text-ink"
          >
            <Rss size={13} aria-hidden />
            {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
          </button>
        }
      />
      <FetchNotice />
      {troubled > 0 && (
        <button
          type="button"
          onClick={() => openSources(topicId)}
          className="mx-auto flex w-full max-w-[640px] items-center gap-1.5 text-left text-[13px] text-nope hover:underline"
        >
          <TriangleAlert size={14} aria-hidden className="shrink-0" />
          {troubled} {troubled === 1 ? "source isn't" : "sources aren't"} bringing articles · Review
        </button>
      )}
      <div className="flex min-h-[380px] flex-1 items-center justify-center">
        {remaining ? (
          <Deck ref={deckRef} topic={topic} itemIds={queue} onDecide={onDecide} />
        ) : total === 0 ? (
          <div className="grid h-full">
            <Empty
              title="No articles yet"
              body={`Readar is checking your ${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}. New articles show up here within a few minutes.`}
              action={
                <button
                  type="button"
                  onClick={() => openSources(topicId)}
                  className="mt-1 rounded-ui bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-ink"
                >
                  Review sources
                </button>
              }
            />
          </div>
        ) : (
          <div className="grid h-full">
            <Empty
              title="All caught up"
              body="New articles show up here as your sources publish them."
              action={
                canUndo ? (
                  <button
                    type="button"
                    onClick={actions.undo}
                    className="mt-1 rounded-ui bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-ink"
                  >
                    Undo last swipe
                  </button>
                ) : undefined
              }
            />
          </div>
        )}
      </div>
      <ActionBar actions={actions} empty={!remaining} canUndo={canUndo} />
    </>
  )
}

/** Shown while the worker fetches sources the user just added. */
function FetchNotice() {
  const status = useFetchNow((s) => s.status)
  if (status === 'idle') return null
  return (
    <p
      role="status"
      className="mx-auto flex w-full max-w-[640px] items-center gap-1.5 text-[13px] text-muted"
    >
      {status === 'fetching' ? (
        <LoaderCircle size={14} aria-hidden className="shrink-0 motion-safe:animate-spin" />
      ) : (
        <Clock size={14} aria-hidden className="shrink-0" />
      )}
      {status === 'fetching'
        ? 'Fetching new articles…'
        : "Your new sources will be fetched within 15 minutes. Cards appear here when they're in."}
    </p>
  )
}
