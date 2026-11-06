import { Plus, Settings as SettingsIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { LISTS } from '@/deck/lists'
import { deckStore, useDeck } from '@/deck/store'
import { TopicIcon } from '@/deck/TopicIcon'
import type { View } from '@/deck/types'
import { cn } from '@/lib/cn'
import { useSetup } from '@/onboarding/store'

interface NavProps {
  onSettings: () => void
}

function useNav() {
  const topics = useDeck((s) => s.topics)
  const queues = useDeck((s) => s.queues)
  const totals = useDeck((s) => s.totals)
  const lists = useDeck((s) => s.lists)
  const view = useDeck((s) => s.view)
  const isActive = (kind: View['kind'], id: string) => view.kind === kind && view.id === id
  const select = (next: View) => deckStore.getState().select(next)
  /** Cards left, a check when caught up, nothing while a topic has never had cards. */
  const badge = (topicId: string): ReactNode => {
    if (!totals[topicId]) return undefined
    return queues[topicId]?.length || '✓'
  }
  return { topics, queues, lists, isActive, select, badge }
}

const editTopics = () => useSetup.getState().goTo('topics')

/* Native Glass: frosted sidebar with colored topic icons (wide windows). */

export function GlassSidebar({ onSettings }: NavProps) {
  const { topics, lists, isActive, select, badge } = useNav()
  return (
    <nav
      aria-label="Topics and library"
      className="hidden min-h-0 flex-col gap-0.5 overflow-y-auto border-r border-glass-line bg-glass px-2.5 pb-3 pt-12 backdrop-blur-2xl backdrop-saturate-150 md:flex"
    >
      <p className="px-2 pb-1 text-[11px] font-semibold text-muted">Topics</p>
      {topics.map((topic, index) => (
        <NavRow
          key={topic.id}
          active={isActive('topic', topic.id)}
          onClick={() => select({ kind: 'topic', id: topic.id })}
          icon={<TopicIcon topic={topic} size="sm" />}
          label={topic.name}
          count={badge(topic.id)}
          title={`${topic.shortName ?? topic.name} (press ${index + 1})`}
        />
      ))}
      <NavRow
        onClick={editTopics}
        icon={<Plus size={14} className="mx-1 text-muted" />}
        label="Add or edit topics"
        muted
      />
      <p className="px-2 pb-1 pt-4 text-[11px] font-semibold text-muted">Library</p>
      {LISTS.map((list) => (
        <NavRow
          key={list.id}
          active={isActive('list', list.id)}
          onClick={() => select({ kind: 'list', id: list.id })}
          icon={<list.Icon size={15} className={cn('mx-1', list.tone)} />}
          label={list.name}
          count={lists[list.id].length || undefined}
        />
      ))}
      <div className="mt-auto pt-4">
        <NavRow
          onClick={onSettings}
          icon={<SettingsIcon size={15} className="mx-1 text-muted" />}
          label="Settings"
          title="Settings (⌘,)"
        />
      </div>
    </nav>
  )
}

interface NavRowProps {
  onClick: () => void
  icon: ReactNode
  label: string
  active?: boolean
  count?: ReactNode
  title?: string
  muted?: boolean
}

function NavRow({ onClick, icon, label, active, count, title, muted }: NavRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13.5px] hover:bg-hover',
        active && 'bg-sel font-semibold',
        muted && 'text-muted',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-[12px] text-muted tabular-nums">{count}</span>}
    </button>
  )
}

/* Native Glass on narrow windows and phones: a strip of chips. */

export function TopicStrip({ onSettings }: NavProps) {
  const { topics, queues, lists, isActive, select } = useNav()
  return (
    <nav
      aria-label="Topics and library"
      className="flex gap-2 overflow-x-auto border-b border-glass-line bg-glass px-3 pb-2.5 pt-[max(2.25rem,env(safe-area-inset-top))] backdrop-blur-2xl md:hidden"
    >
      {topics.map((topic) => (
        <Chip
          key={topic.id}
          active={isActive('topic', topic.id)}
          onClick={() => select({ kind: 'topic', id: topic.id })}
        >
          {topic.emoji} {topic.shortName ?? topic.name}{' '}
          <b className="tabular-nums">{queues[topic.id]?.length ?? 0}</b>
        </Chip>
      ))}
      <Chip onClick={editTopics} label="Add or edit topics">
        <Plus size={14} />
      </Chip>
      {LISTS.map((list) => (
        <Chip
          key={list.id}
          active={isActive('list', list.id)}
          onClick={() => select({ kind: 'list', id: list.id })}
        >
          <list.Icon size={13} className={list.tone} />
          {list.name} <b className="tabular-nums">{lists[list.id].length}</b>
        </Chip>
      ))}
      <Chip onClick={onSettings} label="Settings">
        <SettingsIcon size={14} />
      </Chip>
    </nav>
  )
}

function Chip({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean
  onClick: () => void
  label?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] whitespace-nowrap',
        active ? 'border-ink bg-ink text-app' : 'border-line bg-surface',
      )}
    >
      {children}
    </button>
  )
}

/* Editorial Calm: an edition masthead with text tabs. */

const editionDate = () =>
  new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(),
  )

export function EditionHeader({ onSettings }: NavProps) {
  const { topics, queues, lists, isActive, select } = useNav()
  const [today] = useState(editionDate)
  return (
    <header className="border-b border-line px-5 pt-[max(2.25rem,env(safe-area-inset-top))] md:px-10">
      <div className="mx-auto flex max-w-[760px] items-baseline justify-between gap-4">
        <span className="font-display text-[30px] font-semibold tracking-tight">Readar</span>
        <span className="text-[11.5px] font-medium tracking-[0.14em] text-muted uppercase">
          {today}
        </span>
      </div>
      <nav
        aria-label="Topics and library"
        className="mx-auto mt-3 flex max-w-[760px] gap-5 overflow-x-auto text-[14px]"
      >
        {topics.map((topic) => (
          <Tab
            key={topic.id}
            active={isActive('topic', topic.id)}
            onClick={() => select({ kind: 'topic', id: topic.id })}
          >
            {topic.shortName ?? topic.name}{' '}
            <span className="text-muted tabular-nums">{queues[topic.id]?.length ?? 0}</span>
          </Tab>
        ))}
        <Tab onClick={editTopics}>+ Topics</Tab>
        <span aria-hidden className="self-center pb-2.5 text-line">
          |
        </span>
        {LISTS.map((list) => (
          <Tab
            key={list.id}
            active={isActive('list', list.id)}
            onClick={() => select({ kind: 'list', id: list.id })}
          >
            {list.name} <span className="text-muted tabular-nums">{lists[list.id].length}</span>
          </Tab>
        ))}
        <Tab onClick={onSettings}>Settings</Tab>
      </nav>
    </header>
  )
}

function Tab({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'shrink-0 border-b-2 pt-1 pb-2.5 whitespace-nowrap',
        active ? 'border-ink font-semibold' : 'border-transparent text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

/* Playful Deck: story-style bubbles with colored rings for unread topics. */

export function Bubbles({ onSettings }: NavProps) {
  const { topics, queues, lists, isActive, select } = useNav()
  return (
    <nav
      aria-label="Topics and library"
      className="flex items-start gap-3.5 overflow-x-auto px-5 pt-[max(2.25rem,env(safe-area-inset-top))] pb-2 md:justify-center"
    >
      {topics.map((topic) => {
        const count = queues[topic.id]?.length ?? 0
        return (
          <Bubble
            key={topic.id}
            active={isActive('topic', topic.id)}
            onClick={() => select({ kind: 'topic', id: topic.id })}
            label={topic.shortName ?? topic.name}
            ring={count ? topic.hue : 'var(--r-line)'}
            badge={count}
          >
            <span className="text-[26px] leading-none">{topic.emoji}</span>
          </Bubble>
        )
      })}
      <Bubble onClick={editTopics} label="Topics" ring="var(--r-line)">
        <Plus size={22} className="text-muted" />
      </Bubble>
      <span aria-hidden className="h-14 w-px shrink-0 bg-line" />
      {LISTS.map((list) => (
        <Bubble
          key={list.id}
          active={isActive('list', list.id)}
          onClick={() => select({ kind: 'list', id: list.id })}
          label={list.name}
          ring="var(--r-line)"
          badge={lists[list.id].length}
        >
          <list.Icon size={22} className={list.tone} />
        </Bubble>
      ))}
      <Bubble onClick={onSettings} label="Settings" ring="var(--r-line)">
        <SettingsIcon size={20} className="text-muted" />
      </Bubble>
    </nav>
  )
}

interface BubbleProps {
  active?: boolean
  onClick: () => void
  label: string
  ring: string
  badge?: number
  children: ReactNode
}

function Bubble({ active, onClick, label, ring, badge, children }: BubbleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="flex w-16 shrink-0 flex-col items-center gap-1.5"
    >
      <span
        className={cn(
          'relative grid size-14 place-items-center rounded-full bg-surface transition-transform',
          active && 'scale-110',
        )}
        style={{ boxShadow: `0 0 0 2.5px var(--r-bg), 0 0 0 5px ${ring}` }}
      >
        {children}
        {badge ? (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-white tabular-nums">
            {badge}
          </span>
        ) : null}
      </span>
      <span className={cn('max-w-full truncate text-[12px]', active ? 'font-bold' : 'text-muted')}>
        {label}
      </span>
    </button>
  )
}
