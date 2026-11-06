import { MessageCircle, Mic, Play, Sparkles } from 'lucide-react'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { useStyle } from '@/theme/ThemeScope'
import { TYPE_LABEL } from './lists'
import type { Item, Topic } from './types'

export interface CardProps {
  item: Item
  topic: Topic
  expanded: boolean
}

/** A deck card in the closest theme's style. Same content in every style. */
export function ItemCard(props: CardProps) {
  const style = useStyle()
  if (style === 'editorial') return <EditorialCard {...props} />
  if (style === 'playful') return <PlayfulCard {...props} />
  return <GlassCard {...props} />
}

function GlassCard({ item, expanded }: CardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-card">
      <Thumb
        item={item}
        className={cn('shrink-0 transition-[height] duration-300', expanded ? 'h-0' : 'h-[150px]')}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 pb-4 pt-4">
        <Meta item={item} />
        <h2 className="font-display text-[20px] leading-tight font-bold tracking-tight text-balance">
          {item.title}
        </h2>
        <p className="text-[15px] leading-relaxed">
          <AiBadge />
          {item.tldr}
        </p>
        {expanded && <Points points={item.points} className="list-disc pl-5" />}
        <Footer item={item} expanded={expanded} />
      </div>
    </article>
  )
}

function EditorialCard({ item, expanded }: CardProps) {
  return (
    <article className="flex h-full flex-col gap-3 overflow-y-auto rounded-card border border-line bg-surface px-7 pb-6 pt-7 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        {item.source} · {TYPE_LABEL[item.type]} · {item.length}
      </p>
      <h2 className="font-display text-[27px] leading-[1.14] font-semibold text-balance">
        {item.title}
      </h2>
      <p className="text-[15.5px] leading-relaxed text-muted">{item.tldr}</p>
      {expanded && <Points points={item.points} className="list-decimal pl-5 marker:text-muted" />}
      <Footer item={item} expanded={expanded} />
    </article>
  )
}

function PlayfulCard({ item, topic, expanded }: CardProps) {
  const background: CSSProperties = {
    backgroundImage: `linear-gradient(150deg, ${item.colors[0]}, ${item.colors[1]})`,
  }
  return (
    <article
      className="relative h-full overflow-hidden rounded-card text-white shadow-card"
      style={background}
    >
      <span
        aria-hidden
        className="absolute left-6 top-5 text-[64px] leading-none drop-shadow-[0_8px_10px_rgb(0_0_0/0.25)]"
      >
        {topic.emoji}
      </span>
      <div className="absolute inset-x-0 bottom-0 flex max-h-full flex-col gap-2 overflow-y-auto bg-linear-to-t from-black/60 via-black/30 to-transparent p-6 pt-16">
        <span className="self-start rounded-full bg-white/25 px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur">
          {TYPE_LABEL[item.type]} · {item.length}
        </span>
        <h2 className="font-display text-[25px] leading-[1.05] font-extrabold text-balance">
          {item.title}
        </h2>
        {expanded ? (
          <Points points={item.points} className="list-disc pl-5 text-[14px]" />
        ) : (
          <p className="text-[14.5px] leading-snug opacity-95">{item.tldr}</p>
        )}
        <p className="text-[12px] opacity-85">
          {item.source} · {item.age}
        </p>
      </div>
    </article>
  )
}

const GLYPHS = { video: Play, thread: MessageCircle, podcast: Mic } as const

function Thumb({ item, className }: { item: Item; className?: string }) {
  const style: CSSProperties = {
    backgroundImage: `radial-gradient(120% 100% at 0% 0%, ${item.colors[0]}, transparent 62%), radial-gradient(110% 120% at 100% 100%, ${item.colors[1]}, transparent 58%)`,
  }
  const Glyph = item.type === 'article' ? null : GLYPHS[item.type]
  return (
    <div className={cn('relative overflow-hidden bg-surface-2', className)} style={style}>
      {Glyph && (
        <span className="absolute inset-0 m-auto grid size-13 place-items-center rounded-full bg-black/45 text-white">
          <Glyph size={22} fill={item.type === 'video' ? 'currentColor' : 'none'} />
        </span>
      )}
      {item.type === 'video' && (
        <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11.5px] text-white tabular-nums">
          {item.length}
        </span>
      )}
    </div>
  )
}

function Meta({ item }: { item: Item }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink">
        {TYPE_LABEL[item.type]}
      </span>
      <span>
        {item.source} · {item.age} · {item.length}
      </span>
      <Signal level={item.signal} />
    </div>
  )
}

const SIGNAL_LABEL = { 1: 'low', 2: 'good', 3: 'strong' } as const

function Signal({ level }: { level: 1 | 2 | 3 }) {
  const label = `Relevance: ${SIGNAL_LABEL[level]}`
  return (
    <span className="inline-flex h-3 items-end gap-0.5" title={label} aria-label={label} role="img">
      {[5, 8, 12].map((height, index) => (
        <i
          key={height}
          className={cn('w-[3px] rounded-[1px]', index < level ? 'bg-accent' : 'bg-line')}
          style={{ height }}
        />
      ))}
    </span>
  )
}

function AiBadge() {
  return (
    <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 align-[1px] text-[11px] font-bold text-accent-ink">
      <Sparkles size={10} aria-hidden />
      AI
    </span>
  )
}

function Points({ points, className }: { points: string[]; className?: string }) {
  return (
    <ul className={cn('space-y-1 text-[14.5px] leading-snug', className)}>
      {points.map((point) => (
        <li key={point}>{point}</li>
      ))}
    </ul>
  )
}

function Footer({ item, expanded }: { item: Item; expanded: boolean }) {
  return (
    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-1 text-[12px] text-muted">
      <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11.5px]">
        {item.why}
      </span>
      {item.alsoCoveredBy > 0 && <span>Also covered by {item.alsoCoveredBy} sources</span>}
      <span className="ml-auto hidden sm:inline">
        {expanded ? 'Space to collapse' : 'Space for the full summary'}
      </span>
    </div>
  )
}
