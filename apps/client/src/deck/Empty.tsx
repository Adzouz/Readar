import type { ReactNode } from 'react'

const RINGS =
  'repeating-radial-gradient(circle closest-side, transparent 0 calc(33.3% - 1px), var(--r-line) calc(33.3% - 1px) 33.3%)'

/** Empty and "all caught up" states: a quiet radar with a ping in the middle. */
export function Empty({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="m-auto grid max-w-[320px] justify-items-center gap-2 text-center text-[14px] text-muted">
      <span
        aria-hidden
        className="relative mb-1 grid size-22 place-items-center rounded-full"
        style={{ backgroundImage: RINGS }}
      >
        <span className="absolute size-2.5 animate-ping rounded-full bg-accent opacity-70" />
        <span className="size-2.5 rounded-full bg-accent" />
      </span>
      <b className="text-[17px] text-ink">{title}</b>
      <span>{body}</span>
      {action}
    </div>
  )
}
