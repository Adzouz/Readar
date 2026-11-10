import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useSetup } from './store'

interface FrameProps {
  step: 1 | 2 | 3 | 4
  title: string
  subtitle: string
  /** Actions of the step, in a bar pinned to the bottom. */
  footer: ReactNode
  children: ReactNode
}

/** Shared layout of the onboarding steps: scrolling content and a fixed action bar. */
export function Frame({ step, title, subtitle, footer, children }: FrameProps) {
  const completed = useSetup((s) => s.completed)
  return (
    <div className="flex h-full flex-col">
      {/* `relative` keeps absolutely positioned descendants (sr-only labels) inside this scroll
          area; without it they stretch the page and add a second scrollbar. */}
      <main className="relative min-h-0 flex-1 overflow-y-auto px-5 pt-[max(3.5rem,env(safe-area-inset-top))] pb-10 md:px-10">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-[12px] font-semibold tracking-[0.12em] text-muted uppercase">
            {completed ? 'Your setup' : `Step ${step} of 4`}
          </p>
          <h1 className="mt-2 font-display text-[clamp(28px,4vw,42px)] leading-tight font-bold tracking-tight text-balance">
            {title}
          </h1>
          <p className="mt-2 max-w-[62ch] text-[16px] text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
      <footer className="border-t border-line bg-surface/85 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:px-10">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3">{footer}</div>
      </footer>
    </div>
  )
}

interface ButtonProps {
  onClick: () => void
  disabled?: boolean
  className?: string
  children: ReactNode
}

export function PrimaryButton({ onClick, disabled, className, children }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-ui bg-ink px-5 py-2.5 text-[14px] font-semibold text-app disabled:opacity-35',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function QuietButton({ onClick, className, children }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-ui px-3 py-2.5 text-[14px] font-medium text-muted hover:bg-hover hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}
