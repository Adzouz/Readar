import { ArrowUpRight, Clock, Heart, Share, Undo2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useStyle } from '@/theme/ThemeScope'
import type { DeckActions } from './actions'

interface ActionBarProps {
  actions: DeckActions
  /** No card on screen: deck actions are disabled. */
  empty: boolean
  canUndo: boolean
}

/** Buttons under the deck, for people who don't swipe. Same actions in every style. */
export function ActionBar(props: ActionBarProps) {
  const style = useStyle()
  if (style === 'editorial') return <EditorialBar {...props} />
  if (style === 'playful') return <PlayfulBar {...props} />
  return <GlassBar {...props} />
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
      <RoundButton label="Open original" hint="↵" onClick={actions.open} disabled={empty}>
        <ArrowUpRight size={19} />
      </RoundButton>
      <RoundButton label="Share" hint="S" onClick={actions.share} disabled={empty}>
        <Share size={18} />
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
  // Slightly smaller on phones so all six buttons fit on one row at 375px.
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
      <kbd className="hidden rounded border border-b-2 border-line bg-surface px-1.5 py-0.5 font-mono text-[10.5px] leading-none text-muted md:inline">
        {hint}
      </kbd>
    </button>
  )
}

function EditorialBar({ actions, empty, canUndo }: ActionBarProps) {
  const button =
    'rounded-ui px-3 py-2 text-[14px] font-semibold text-accent hover:bg-hover disabled:pointer-events-none disabled:opacity-35'
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
      <button type="button" className={button} onClick={actions.open} disabled={empty}>
        ↵ Open
      </button>
      <button type="button" className={button} onClick={actions.share} disabled={empty}>
        Share
      </button>
      <button type="button" className={button} onClick={() => actions.act('like')} disabled={empty}>
        → Keep
      </button>
      <button
        type="button"
        className={cn(button, 'text-muted')}
        onClick={actions.undo}
        disabled={!canUndo}
      >
        Undo
      </button>
    </div>
  )
}

function PlayfulBar({ actions, empty, canUndo }: ActionBarProps) {
  const chunky =
    'grid place-items-center rounded-full bg-surface shadow-[0_5px_0_-1px_var(--r-line),0_0_0_2px_var(--r-line)] transition-transform active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-35'
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        aria-label="Undo"
        className={cn(chunky, 'size-11 text-muted')}
        onClick={actions.undo}
        disabled={!canUndo}
      >
        <Undo2 size={18} />
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        className={cn(chunky, 'size-16 text-nope')}
        onClick={() => actions.act('nope')}
        disabled={empty}
      >
        <X size={28} strokeWidth={3} />
      </button>
      <button
        type="button"
        aria-label="Read later"
        className={cn(chunky, 'size-13 text-later')}
        onClick={() => actions.act('later')}
        disabled={empty}
      >
        <Clock size={22} strokeWidth={2.6} />
      </button>
      <button
        type="button"
        aria-label="Open original"
        className={cn(chunky, 'size-11 text-ink')}
        onClick={actions.open}
        disabled={empty}
      >
        <ArrowUpRight size={18} strokeWidth={2.6} />
      </button>
      <button
        type="button"
        aria-label="Share"
        className={cn(chunky, 'size-11 text-ink')}
        onClick={actions.share}
        disabled={empty}
      >
        <Share size={17} strokeWidth={2.6} />
      </button>
      <button
        type="button"
        aria-label="Like"
        className={cn(chunky, 'size-16 text-like')}
        onClick={() => actions.act('like')}
        disabled={empty}
      >
        <Heart size={26} fill="currentColor" />
      </button>
    </div>
  )
}
