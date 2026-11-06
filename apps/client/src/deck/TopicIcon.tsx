import { cn } from '@/lib/cn'
import type { Topic } from './types'

const SIZES = {
  sm: 'size-5.5 rounded-md text-[12px]',
  md: 'size-8 rounded-lg text-[17px]',
  lg: 'size-10 rounded-[11px] text-[21px]',
}

/** A topic's emoji on a squircle tinted with the topic's color. */
export function TopicIcon({ topic, size = 'md' }: { topic?: Topic; size?: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center leading-none', SIZES[size])}
      style={{
        background: topic ? `color-mix(in srgb, ${topic.hue} 22%, transparent)` : undefined,
      }}
    >
      {topic?.emoji ?? '•'}
    </span>
  )
}
