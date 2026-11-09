import { Check, Plus, Search, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { CATALOG, type CatalogTopic } from '@readar/core'
import { cn } from '@/lib/cn'
import { Frame, PrimaryButton, QuietButton } from './Frame'
import { activeSourceCount, useSetup } from './store'

/** Onboarding step 2: catalog topics as big tiles, plus keyword watches. */
export function TopicPicker() {
  const topicIds = useSetup((s) => s.topicIds)
  const keywords = useSetup((s) => s.keywords)
  const disabledSourceIds = useSetup((s) => s.disabledSourceIds)
  const userSources = useSetup((s) => s.userSources)
  const completed = useSetup((s) => s.completed)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const toggleTopic = useSetup((s) => s.toggleTopic)
  const addKeyword = useSetup((s) => s.addKeyword)
  const removeKeyword = useSetup((s) => s.removeKeyword)
  const goTo = useSetup((s) => s.goTo)
  const count = topicIds.length + keywords.length

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (addKeyword(draft)) {
      setDraft('')
      setError('')
    } else {
      setError(draft.trim() ? 'You already watch that keyword.' : 'Type a word or a name to watch.')
    }
  }

  return (
    <Frame
      step={2}
      title="What do you want to follow?"
      subtitle="Pick as many topics as you like. Each one gets its own deck, so they never mix."
      footer={
        <>
          <QuietButton onClick={() => goTo(completed ? 'done' : 'style')}>
            {completed ? 'Cancel' : 'Back'}
          </QuietButton>
          <span className="ml-auto text-[13px] text-muted tabular-nums">
            {count === 0 ? 'Pick at least one' : `${count} selected`}
          </span>
          <PrimaryButton onClick={() => goTo('sources')} disabled={count === 0}>
            Choose sources
          </PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {CATALOG.map((topic) => (
          <TopicTile
            key={topic.id}
            topic={topic}
            selected={topicIds.includes(topic.id)}
            // Followed topics count what is actually read: suggestions left on plus added links.
            sourceCount={
              topicIds.includes(topic.id)
                ? activeSourceCount({ keywords, disabledSourceIds, userSources }, topic.id)
                : topic.sources.length
            }
            onToggle={() => toggleTopic(topic.id)}
          />
        ))}
      </div>

      <section className="mt-6 rounded-card border border-dashed border-accent bg-accent-soft/60 p-5">
        <h2 className="flex items-center gap-2 text-[16px] font-bold">
          <Search size={16} aria-hidden />
          Watch any keyword
        </h2>
        <p className="mt-1 text-[14px] text-muted">
          A product, a team, a person, a hobby. Readar searches the news and Hacker News for it.
        </p>
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <label htmlFor="keyword" className="sr-only">
            Keyword to watch
          </label>
          <input
            id="keyword"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setError('')
            }}
            placeholder="Strapi, Tauri, Formula 1, sourdough…"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-ui border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex items-center gap-1.5 rounded-ui bg-ink px-4 py-2 text-[14px] font-semibold text-app disabled:opacity-35"
          >
            <Plus size={15} aria-hidden />
            Add
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-nope">
            {error}
          </p>
        )}
        {keywords.length > 0 && (
          <ul aria-label="Keyword watches" className="mt-3 flex flex-wrap gap-2">
            {keywords.map((watch) => (
              <li
                key={watch.id}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-1 pl-3 text-[13.5px]"
              >
                <span aria-hidden>🔎</span>
                {watch.keyword}
                <button
                  type="button"
                  aria-label={`Stop watching ${watch.keyword}`}
                  onClick={() => removeKeyword(watch.id)}
                  className="grid size-6 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Frame>
  )
}

function TopicTile({
  topic,
  selected,
  sourceCount,
  onToggle,
}: {
  topic: CatalogTopic
  selected: boolean
  sourceCount: number
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'relative flex flex-col items-start gap-2 rounded-card border bg-surface p-4 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5',
        selected ? 'border-accent shadow-[0_0_0_2px_var(--r-accent)]' : 'border-line',
      )}
    >
      <span
        aria-hidden
        className="grid size-12 place-items-center rounded-[14px] text-[26px] leading-none"
        style={{ background: `color-mix(in srgb, ${topic.hue} 20%, transparent)` }}
      >
        {topic.emoji}
      </span>
      <span className="font-display text-[16px] leading-tight font-bold">{topic.name}</span>
      <span className="text-[12.5px] leading-snug text-muted">{topic.covers}</span>
      <span className="mt-auto pt-1 text-[12px] text-muted">
        {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute top-3 right-3 grid size-6 place-items-center rounded-full border',
          selected
            ? 'border-accent bg-accent text-white'
            : 'border-line bg-surface text-transparent',
        )}
      >
        <Check size={14} strokeWidth={3} />
      </span>
    </button>
  )
}
