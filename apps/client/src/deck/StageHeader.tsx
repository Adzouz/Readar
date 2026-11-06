import type { ReactNode } from 'react'

interface StageHeaderProps {
  icon: ReactNode
  title: string
  subtitle: string
  /** Share of the topic already reviewed, from 0 to 1. */
  progress?: number
}

export function StageHeader({ icon, title, subtitle, progress }: StageHeaderProps) {
  return (
    <header className="mx-auto flex w-full max-w-[640px] flex-wrap items-center gap-3">
      {icon}
      <div className="min-w-0">
        <h1 className="font-display text-[21px] leading-tight font-bold tracking-tight">{title}</h1>
        <p className="text-[13px] text-muted">{subtitle}</p>
      </div>
      {progress !== undefined && (
        <div
          role="progressbar"
          aria-label="Reviewed"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="ml-auto h-1.5 w-32 overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </header>
  )
}
