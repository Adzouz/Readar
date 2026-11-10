import {
  Link2,
  LoaderCircle,
  Mic,
  Play,
  Plus,
  Rss,
  Search,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { CatalogSource, SourceKind } from '@readar/core'
import { TopicIcon } from '@/deck/TopicIcon'
import type { Topic } from '@/deck/types'
import { cn } from '@/lib/cn'
import { supabase } from '@/lib/supabase'
import {
  healthKey,
  healthOf,
  loadSourceHealth,
  SYNCING,
  useSourceHealth,
} from '@/sync/sourceHealth'
import { Switch } from '@/lib/Switch'
import { Frame, PrimaryButton, QuietButton } from './Frame'
import { followedTopics, suggestedSources, useSetup, type UserSource } from './store'

const KIND: Record<SourceKind, { label: string; Icon: LucideIcon }> = {
  feed: { label: 'Website', Icon: Rss },
  youtube: { label: 'YouTube', Icon: Play },
  podcast: { label: 'Podcast', Icon: Mic },
  search: { label: 'Search', Icon: Search },
  link: { label: 'Your link', Icon: Link2 },
}

const HEALTH_REFRESH_MS = 30_000

/** Onboarding step 3: suggested sources per followed topic, switchable, plus the user's links. */
export function SourcePicker() {
  const topicIds = useSetup((s) => s.topicIds)
  const keywords = useSetup((s) => s.keywords)
  const disabled = useSetup((s) => s.disabledSourceIds)
  const userSources = useSetup((s) => s.userSources)
  const completed = useSetup((s) => s.completed)
  const goTo = useSetup((s) => s.goTo)
  const finish = useSetup((s) => s.finish)
  const sourcesFrom = useSetup((s) => s.sourcesFrom)
  const topics = followedTopics({ topicIds, keywords })

  // Opened from a topic: show that topic's sources first.
  useEffect(() => {
    if (sourcesFrom) {
      document.getElementById(`sources-${sourcesFrom}`)?.scrollIntoView({ block: 'start' })
    }
  }, [sourcesFrom])

  // Fresh fetch results when the screen opens, then now and again: the worker fetches a new link
  // within minutes, and the first call can fail while the session is still starting.
  useEffect(() => {
    void loadSourceHealth()
    const timer = setInterval(() => void loadSourceHealth(), HEALTH_REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  const sourcesOn = topics.reduce((sum, topic) => {
    const suggested = suggestedSources(topic.id, keywords)
    const on = suggested.filter((source) => !disabled.includes(source.id)).length
    return sum + on + userSources.filter((source) => source.topicId === topic.id).length
  }, 0)

  return (
    <Frame
      step={3}
      title="Choose your sources"
      subtitle="We picked a few for each topic. Switch off what you don't want, or add your own links."
      footer={
        <>
          <QuietButton onClick={() => goTo(sourcesFrom ? 'done' : 'topics')}>Back</QuietButton>
          <span className="ml-auto text-[13px] text-muted tabular-nums">
            {sourcesOn} {sourcesOn === 1 ? 'source' : 'sources'} on
          </span>
          <PrimaryButton onClick={completed ? finish : () => goTo('claude')}>
            {completed ? 'Save' : 'Continue'}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {topics.map((topic) => (
          <TopicSources
            key={topic.id}
            topic={topic}
            sources={suggestedSources(topic.id, keywords)}
            disabled={disabled}
            userSources={userSources.filter((source) => source.topicId === topic.id)}
          />
        ))}
      </div>
    </Frame>
  )
}

interface TopicSourcesProps {
  topic: Topic
  sources: CatalogSource[]
  disabled: string[]
  userSources: UserSource[]
}

function TopicSources({ topic, sources, disabled, userSources }: TopicSourcesProps) {
  const toggleSource = useSetup((s) => s.toggleSource)
  const removeUserSource = useSetup((s) => s.removeUserSource)
  const on = sources.filter((source) => !disabled.includes(source.id)).length + userSources.length
  return (
    <section
      id={`sources-${topic.id}`}
      className="scroll-mt-4 rounded-card border border-line bg-surface p-4"
    >
      <header className="flex items-center gap-3">
        <TopicIcon topic={topic} />
        <div className="min-w-0">
          <h2 className="font-display text-[16px] leading-tight font-bold">{topic.name}</h2>
          <p className="text-[12.5px] text-muted">
            {on} of {sources.length + userSources.length} on
          </p>
        </div>
      </header>
      <ul className="mt-2 divide-y divide-line">
        {sources.map((source) => (
          <SourceRow
            key={source.id}
            topicId={topic.id}
            source={source}
            on={!disabled.includes(source.id)}
            onToggle={() => toggleSource(source.id)}
          />
        ))}
        {userSources.map((source) => (
          <UserSourceRow
            key={source.id}
            source={source}
            onRemove={() => removeUserSource(source.id)}
          />
        ))}
      </ul>
      <AddSource topicId={topic.id} />
    </section>
  )
}

/** Fetch status for a source row: what it brought, or why it brings nothing. */
function Health({ topicId, id }: { topicId: string; id: string }) {
  const row = useSourceHealth((s) => s.rows[healthKey(topicId, id)])
  const workerActive = useSourceHealth((s) => s.workerActive)
  const loaded = useSourceHealth((s) => s.loaded)
  // Sample-card mode never fetches anything; before the first answer we don't know yet.
  if (!supabase || !loaded) return null
  const health = healthOf(row, workerActive)
  const troubled = health.state === 'failing' || health.state === 'empty'
  return (
    <p
      className={cn('flex items-center gap-1 text-[12.5px]', troubled ? 'text-nope' : 'text-muted')}
    >
      {troubled && <TriangleAlert size={12} aria-hidden className="shrink-0" />}
      {health === SYNCING && (
        <LoaderCircle size={12} aria-hidden className="shrink-0 motion-safe:animate-spin" />
      )}
      {health.label}
    </p>
  )
}

function SourceRow({
  topicId,
  source,
  on,
  onToggle,
}: {
  topicId: string
  source: CatalogSource
  on: boolean
  onToggle: () => void
}) {
  const { label, Icon } = KIND[source.kind]
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        aria-hidden
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full bg-surface-2',
          on ? 'text-ink' : 'text-muted',
        )}
      >
        <Icon size={15} />
      </span>
      <div className={cn('min-w-0 flex-1 transition-opacity', !on && 'opacity-50')}>
        <p className="text-[14px] leading-snug font-medium">{source.name}</p>
        <p className="text-[12.5px] text-muted">
          {label} · {source.site}
        </p>
        {on && <Health topicId={topicId} id={source.id} />}
      </div>
      <Switch checked={on} onChange={onToggle} label={source.name} />
    </li>
  )
}

function UserSourceRow({ source, onRemove }: { source: UserSource; onRemove: () => void }) {
  const host = new URL(source.url).hostname.replace(/^www\./, '')
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink"
      >
        <Link2 size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-snug font-medium break-all">{host}</p>
        <p className="text-[12.5px] text-muted">Your link</p>
        <Health topicId={source.topicId} id={source.url} />
      </div>
      <button
        type="button"
        aria-label={`Remove ${host}`}
        onClick={onRemove}
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink"
      >
        <X size={15} />
      </button>
    </li>
  )
}

function AddSource({ topicId }: { topicId: string }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const addUserSource = useSetup((s) => s.addUserSource)
  const inputId = `add-source-${topicId}`

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (addUserSource(topicId, value)) {
      setValue('')
      setError('')
    } else {
      setError("That doesn't look like a link. Try example.com or a YouTube channel address.")
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 border-t border-line pt-3">
      <label htmlFor={inputId} className="sr-only">
        Add a link to this topic
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError('')
          }}
          placeholder="Add a site, feed or YouTube channel link"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-ui border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-ui bg-surface-2 px-3 py-2 text-[14px] font-semibold disabled:opacity-40"
        >
          <Plus size={15} aria-hidden />
          Add
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[12.5px] text-nope">
          {error}
        </p>
      )}
    </form>
  )
}
