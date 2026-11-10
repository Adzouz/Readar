import { LoaderCircle, Sparkles } from 'lucide-react'
import { useSummaries } from '@/claude/summaries'
import { openExternal } from '@/lib/platform'
import { useToast } from '@/shell/toast'
import { summarizeItem } from './actions'
import { AiBadge } from './cards'
import { Empty } from './Empty'
import { LIST_META, TYPE_LABEL } from './lists'
import { StageHeader } from './StageHeader'
import { deckStore, useDeck } from './store'
import { TopicIcon } from './TopicIcon'
import type { ListId } from './types'

/** Liked, Read later and Dismissed, newest first. */
export function ListView({ listId }: { listId: ListId }) {
  const ids = useDeck((s) => s.lists[listId])
  const items = useDeck((s) => s.items)
  const topics = useDeck((s) => s.topics)
  const show = useToast((s) => s.show)
  const pending = useSummaries((s) => s.pending)
  const meta = LIST_META[listId]
  const rows = [...ids].reverse()

  return (
    <>
      <StageHeader
        icon={
          <span
            className={`grid size-10 place-items-center rounded-[11px] bg-surface-2 ${meta.tone}`}
          >
            <meta.Icon size={18} />
          </span>
        }
        title={meta.name}
        subtitle={`${rows.length} ${rows.length === 1 ? 'item' : 'items'} · synced to your other devices`}
      />
      {rows.length === 0 ? (
        <div className="grid flex-1">
          <Empty title="Nothing here yet" body={meta.empty} />
        </div>
      ) : (
        <ul className="mx-auto flex min-h-0 w-full max-w-[640px] flex-1 flex-col gap-2 overflow-y-auto pb-4">
          {rows.map((id) => {
            const item = items[id]
            if (!item) return null
            const topic = topics.find((t) => t.id === item.topicId)
            const topicName = topic?.shortName ?? topic?.name ?? ''
            return (
              <li
                key={id}
                className="flex items-center gap-3 rounded-ui border border-line bg-surface px-3 py-2.5"
              >
                <TopicIcon topic={topic} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-snug font-semibold">{item.title}</p>
                  <p className="text-[12.5px] text-muted">
                    {item.source} · {TYPE_LABEL[item.type]} · {topicName}
                  </p>
                  {item.summary && (
                    <p className="mt-1 text-[13px] leading-snug">
                      <AiBadge className="mr-1.5" />
                      {item.summary.tldr}
                    </p>
                  )}
                </div>
                {!item.summary && (
                  <button
                    type="button"
                    aria-label={`Summarize ${item.title}`}
                    title="Summarize with Claude"
                    disabled={pending[id]}
                    onClick={() => void summarizeItem(item, show)}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-accent hover:bg-hover disabled:opacity-60"
                  >
                    {pending[id] ? (
                      <LoaderCircle size={15} aria-hidden className="motion-safe:animate-spin" />
                    ) : (
                      <Sparkles size={15} aria-hidden />
                    )}
                  </button>
                )}
                {listId === 'dismissed' && (
                  <RowButton
                    onClick={() => {
                      deckStore.getState().restore(id)
                      show(`Back in ${topicName}`)
                    }}
                  >
                    Restore
                  </RowButton>
                )}
                {listId === 'later' && (
                  <RowButton
                    onClick={() => {
                      deckStore.getState().markRead(id)
                      show('Marked as read')
                    }}
                  >
                    Mark read
                  </RowButton>
                )}
                {listId === 'liked' && (
                  <RowButton onClick={() => void openExternal(item.url)}>Open</RowButton>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function RowButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-ui bg-accent-soft px-3 py-1.5 text-[12.5px] font-semibold text-accent-ink"
    >
      {children}
    </button>
  )
}
