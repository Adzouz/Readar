import { ArrowUpRight, Clock, Heart, LoaderCircle, Share, Sparkles, Undo2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useStyle } from '@/theme/ThemeScope'
import { useSummaries } from '@/claude/summaries'
import type { DeckActions } from './actions'
import { useDeck } from './store'

interface ActionBarProps {
  actions: DeckActions
  /** No card on screen: deck actions are disabled. */
  empty: boolean
  canUndo: boolean
}

/** Buttons under the deck, for people who don't swipe. Same actions in every style. */
export function ActionBar(props: ActionBarProps) {
  const style = useStyle()
  const Bar = style === 'editorial' ? EditorialBar : style === 'playful' ? PlayfulBar : GlassBar
  return (
    <div className="grid justify-items-center gap-2 sm:gap-3">
      <div className="flex flex-wrap items-center justify-center gap-1">
        <OpenLink onClick={props.actions.open} disabled={props.empty} />
        <SummarizeButton onClick={props.actions.summarize} disabled={props.empty} />
      </div>
      <Bar {...props} />
    </div>
  )
}

/** "Open link" above the swipe buttons: reads the original article. */
function OpenLink({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      title="Open the original (↵)"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-accent hover:bg-hover disabled:pointer-events-none disabled:opacity-35"
    >
      Open link
      <ArrowUpRight size={15} strokeWidth={2.4} aria-hidden />
      <Kbd className="ml-1">↵</Kbd>
    </button>
  )
}

/** Claude summary of the top card. Hidden once the card is summarized. */
function SummarizeButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const item = useDeck((s) => {
    if (s.view.kind !== 'topic') return undefined
    const id = s.queues[s.view.id]?.[0]
    return id ? s.items[id] : undefined
  })
  const pending = useSummaries((s) => (item ? s.pending[item.id] === true : false))
  if (item?.summarized) return null
  return (
    <button
      type="button"
      title="Summarize with Claude (A)"
      onClick={onClick}
      disabled={disabled || pending}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-accent hover:bg-hover disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? (
        <LoaderCircle size={15} aria-hidden className="motion-safe:animate-spin" />
      ) : (
        <Sparkles size={15} aria-hidden />
      )}
      {pending ? 'Summarizing…' : 'Summarize'}
      <Kbd className="ml-1">A</Kbd>
    </button>
  )
}

function GlassBar({ actions, empty, canUndo }: ActionBarProps) {
  return (
    <div className="flex flex-wrap items-start justify-center gap-2 sm:gap-3.5">
      <RoundButton label="Undo" hint="⌘Z" onClick={actions.undo} disabled={!canUndo} size="sm">
        <Undo2 size={16} />
      </RoundButton>
      <RoundButton
        label="Dismiss"
        hint="←"
        onClick={() => actions.act('nope')}
        disabled={empty}
        size="lg"
        tone="text-nope"
      >
        <X size={24} strokeWidth={2.4} />
      </RoundButton>
      <RoundButton
        label="Read later"
        hint="↑"
        onClick={() => actions.act('later')}
        disabled={empty}
        tone="text-later"
      >
        <Clock size={20} />
      </RoundButton>
      <RoundButton
        label="Like"
        hint="→"
        onClick={() => actions.act('like')}
        disabled={empty}
        size="lg"
        tone="text-like"
      >
        <Heart size={22} fill="currentColor" />
      </RoundButton>
      <RoundButton label="Share" hint="S" onClick={actions.share} disabled={empty}>
        <Share size={18} />
      </RoundButton>
    </div>
  )
}

interface RoundButtonProps {
  label: string
  hint: string
  onClick: () => void
  disabled: boolean
  size?: 'sm' | 'md' | 'lg'
  tone?: string
  children: ReactNode
}

function RoundButton({
  label,
  hint,
  onClick,
  disabled,
  size = 'md',
  tone,
  children,
}: RoundButtonProps) {
  // Slightly smaller on phones so all the buttons fit on one row at 375px.
  const sizes = {
    sm: 'mt-1.5 size-10',
    md: 'size-11.5 sm:size-12.5',
    lg: 'size-14 sm:size-15',
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={`${label} (${hint})`}
      onClick={onClick}
      disabled={disabled}
      className="group grid justify-items-center gap-1.5 disabled:pointer-events-none disabled:opacity-35"
    >
      <span
        className={cn(
          'grid place-items-center rounded-full border border-line bg-surface shadow-[0_2px_8px_rgb(12_26_35/0.08)] transition-transform group-hover:-translate-y-0.5',
          sizes[size],
          tone ?? 'text-ink',
        )}
      >
        {children}
      </span>
      <Kbd>{hint}</Kbd>
    </button>
  )
}

/** Keyboard shortcut under or next to a button. Desktop only: phones have no keyboard. */
function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'hidden rounded border border-b-2 border-line bg-surface px-1.5 py-0.5 font-mono text-[10.5px] leading-none font-normal text-muted md:inline',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

function EditorialBar({ actions, empty, canUndo }: ActionBarProps) {
  const button =
    'flex items-center gap-1.5 rounded-ui px-3 py-2 text-[14px] font-semibold text-accent hover:bg-hover disabled:pointer-events-none disabled:opacity-35'
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-wrap items-center justify-between gap-1 border-t border-line pt-3">
      <button type="button" className={button} onClick={() => actions.act('nope')} disabled={empty}>
        ← Skip
      </button>
      <button
        type="button"
        className={button}
        onClick={() => actions.act('later')}
        disabled={empty}
      >
        ↑ Save
      </button>
      <button type="button" className={button} onClick={() => actions.act('like')} disabled={empty}>
        → Keep
      </button>
      <button type="button" className={button} onClick={actions.share} disabled={empty}>
        Share <Kbd>S</Kbd>
      </button>
      <button
        type="button"
        className={cn(button, 'text-muted')}
        onClick={actions.undo}
        disabled={!canUndo}
      >
        Undo <Kbd>⌘Z</Kbd>
      </button>
    </div>
  )
}

interface ChunkyButtonProps {
  label: string
  hint: string
  onClick: () => void
  disabled: boolean
  /** Tailwind size and color classes for the round button. */
  className: string
  children: ReactNode
}

function ChunkyButton({ label, hint, onClick, disabled, className, children }: ChunkyButtonProps) {
  return (
    <div className="grid justify-items-center gap-2">
      {/* Same-height slot for every button so the shortcut hints line up. */}
      <div className="grid h-16 place-items-center">
        <button
          type="button"
          aria-label={label}
          title={`${label} (${hint})`}
          className={cn(
            'grid place-items-center rounded-full bg-surface shadow-[0_5px_0_-1px_var(--r-line),0_0_0_2px_var(--r-line)] transition-transform active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-35',
            className,
          )}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </button>
      </div>
      <Kbd>{hint}</Kbd>
    </div>
  )
}

function PlayfulBar({ actions, empty, canUndo }: ActionBarProps) {
  return (
    <div className="flex items-start justify-center gap-4">
      <ChunkyButton
        label="Undo"
        hint="⌘Z"
        onClick={actions.undo}
        disabled={!canUndo}
        className="size-11 text-muted"
      >
        <Undo2 size={18} />
      </ChunkyButton>
      <ChunkyButton
        label="Dismiss"
        hint="←"
        onClick={() => actions.act('nope')}
        disabled={empty}
        className="size-16 text-nope"
      >
        <X size={28} strokeWidth={3} />
      </ChunkyButton>
      <ChunkyButton
        label="Read later"
        hint="↑"
        onClick={() => actions.act('later')}
        disabled={empty}
        className="size-13 text-later"
      >
        <Clock size={22} strokeWidth={2.6} />
      </ChunkyButton>
      <ChunkyButton
        label="Like"
        hint="→"
        onClick={() => actions.act('like')}
        disabled={empty}
        className="size-16 text-like"
      >
        <Heart size={26} fill="currentColor" />
      </ChunkyButton>
      <ChunkyButton
        label="Share"
        hint="S"
        onClick={actions.share}
        disabled={empty}
        className="size-11 text-ink"
      >
        <Share size={17} strokeWidth={2.6} />
      </ChunkyButton>
    </div>
  )
}
