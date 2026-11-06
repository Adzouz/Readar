import type { ReactNode } from 'react'

interface StageHeaderProps {
  icon: ReactNode
  title: string
  subtitle?: string
  /** Cards reviewed and in total, for the progress bar. */
  progress?: { done: number; total: number }
}

export function StageHeader({ icon, title, subtitle, progress }: StageHeaderProps) {
  return (
    <header className="mx-auto flex w-full max-w-[640px] flex-wrap items-center gap-3">
      {icon}
      <div className="min-w-0">
        <h1 className="font-display text-[21px] leading-tight font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
      </div>
      {progress && progress.total > 0 && (
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] text-muted tabular-nums">
            {progress.done} of {progress.total} reviewed
          </span>
          <div
            role="progressbar"
            aria-label="Reviewed"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            className="h-1.5 w-20 overflow-hidden rounded-full bg-line sm:w-28"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </header>
  )
}
