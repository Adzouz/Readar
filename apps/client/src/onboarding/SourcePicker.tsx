import { Link2, Mic, Play, Plus, Rss, Search, X, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { CatalogSource, SourceKind } from '@readar/core'
import { TopicIcon } from '@/deck/TopicIcon'
import type { Topic } from '@/deck/types'
import { cn } from '@/lib/cn'
import { Frame, PrimaryButton, QuietButton } from './Frame'
import { followedTopics, suggestedSources, useSetup, type UserSource } from './store'

const KIND: Record<SourceKind, { label: string; Icon: LucideIcon }> = {
  feed: { label: 'Website', Icon: Rss },
  youtube: { label: 'YouTube', Icon: Play },
  podcast: { label: 'Podcast', Icon: Mic },
  search: { label: 'Search', Icon: Search },
  link: { label: 'Your link', Icon: Link2 },
}

/** Onboarding step 3: suggested sources per followed topic, switchable, plus the user's links. */
export function SourcePicker() {
  const topicIds = useSetup((s) => s.topicIds)
  const keywords = useSetup((s) => s.keywords)
  const disabled = useSetup((s) => s.disabledSourceIds)
  const userSources = useSetup((s) => s.userSources)
  const completed = useSetup((s) => s.completed)
  const goTo = useSetup((s) => s.goTo)
  const finish = useSetup((s) => s.finish)
  const topics = followedTopics({ topicIds, keywords })

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
          <QuietButton onClick={() => goTo('topics')}>Back</QuietButton>
          <span className="ml-auto text-[13px] text-muted tabular-nums">
            {sourcesOn} {sourcesOn === 1 ? 'source' : 'sources'} on
          </span>
          <PrimaryButton onClick={finish}>{completed ? 'Save' : 'Start reading'}</PrimaryButton>
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
    <section className="rounded-card border border-line bg-surface p-4">
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

function SourceRow({
  source,
  on,
  onToggle,
}: {
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
        <p className="text-[12.5px] text-muted">
          Your link · Readar finds its feed when it fetches
        </p>
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

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'relative h-6 w-10 shrink-0 rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-line',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform',
          checked && 'translate-x-4',
        )}
      />
    </button>
  )
}
