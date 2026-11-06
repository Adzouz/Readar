import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useCallback, useImperativeHandle, useRef, type Ref } from 'react'
import { cn } from '@/lib/cn'
import { ItemCard } from './cards'
import { deckStore, useDeck } from './store'
import type { Action, Item, Topic } from './types'

export interface DeckHandle {
  /** Animates the top card out (swipe direction for the action), then decides it. */
  fling: (action: Action) => void
}

type Bezier = [number, number, number, number]
const EASE_OUT: Bezier = [0.3, 0.6, 0.3, 1]
const EASE_RISE: Bezier = [0.2, 0.7, 0.3, 1]
const SPRING = { type: 'spring', stiffness: 520, damping: 38 } as const
/** Drag distance (px) or speed (px/s) that commits a swipe. */
const DISTANCE = 110
const VELOCITY = 900

interface DeckProps {
  ref?: Ref<DeckHandle>
  topic: Topic
  itemIds: string[]
  onDecide: (action: Action) => void
}

/** Up to three stacked cards. Only the top one can be dragged. */
export function Deck({ ref, topic, itemIds, onDecide }: DeckProps) {
  const items = useDeck((s) => s.items)
  const expanded = useDeck((s) => s.expanded)
  const top = useRef<DeckHandle>(null)
  useImperativeHandle(ref, () => ({ fling: (action) => top.current?.fling(action) }), [])

  const layers = itemIds.slice(0, 3).map((id, depth) => {
    const item = items[id]
    if (!item) return null
    if (depth === 0) {
      return (
        <SwipeCard
          key={id}
          ref={top}
          item={item}
          topic={topic}
          expanded={expanded}
          onDecide={onDecide}
        />
      )
    }
    return (
      <div
        key={id}
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-[transform,opacity] duration-300"
        style={{
          transform: `translateY(${depth * 14}px) scale(${1 - depth * 0.045})`,
          opacity: depth === 2 ? 0.6 : 1,
        }}
      >
        <ItemCard item={item} topic={topic} expanded={false} />
      </div>
    )
  })

  // Render back to front so the top card paints last. Height is capped so tall windows don't
  // stretch cards into empty space.
  return (
    <div className="relative h-full max-h-[500px] w-full max-w-[560px]">{layers.reverse()}</div>
  )
}

interface SwipeCardProps {
  ref?: Ref<DeckHandle>
  item: Item
  topic: Topic
  expanded: boolean
  onDecide: (action: Action) => void
}

function SwipeCard({ ref, item, topic, expanded, onDecide }: SwipeCardProps) {
  const reduceMotion = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-320, 320], [-14, 14])
  const likeOpacity = useTransform(x, [24, DISTANCE], [0, 1])
  const nopeOpacity = useTransform(x, [-DISTANCE, -24], [1, 0])
  const laterOpacity = useTransform(y, [-DISTANCE, -24], [1, 0])
  const leaving = useRef(false)

  const fling = useCallback(
    (action: Action) => {
      if (leaving.current) return
      leaving.current = true
      if (reduceMotion) {
        onDecide(action)
        return
      }
      const transition = { duration: 0.32, ease: EASE_OUT }
      const done = () => onDecide(action)
      if (action === 'later') {
        void animate(y, -window.innerHeight, transition).then(done)
      } else {
        const direction = action === 'like' ? 1 : -1
        void animate(x, direction * (window.innerWidth + 200), transition).then(done)
      }
    },
    [onDecide, reduceMotion, x, y],
  )

  useImperativeHandle(ref, () => ({ fling }), [fling])

  return (
    <motion.div
      className="absolute inset-0"
      initial={reduceMotion ? false : { scale: 0.955, y: 14 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE_RISE }}
    >
      <motion.div
        className="relative h-full cursor-grab touch-none select-none active:cursor-grabbing"
        style={{ x, y, rotate }}
        drag
        dragMomentum={false}
        onDragEnd={(_, { offset, velocity }) => {
          if (offset.x > DISTANCE || velocity.x > VELOCITY) fling('like')
          else if (offset.x < -DISTANCE || velocity.x < -VELOCITY) fling('nope')
          else if (offset.y < -DISTANCE || velocity.y < -VELOCITY) fling('later')
          else {
            void animate(x, 0, SPRING)
            void animate(y, 0, SPRING)
          }
        }}
        onTap={() => deckStore.getState().toggleExpanded()}
      >
        <ItemCard item={item} topic={topic} expanded={expanded} />
        <Stamp label="Like" opacity={likeOpacity} className="left-5 top-5 -rotate-12 text-like" />
        <Stamp label="Nope" opacity={nopeOpacity} className="right-5 top-5 rotate-12 text-nope" />
        <Stamp
          label="Later"
          opacity={laterOpacity}
          className="bottom-6 left-1/2 -translate-x-1/2 text-later"
        />
      </motion.div>
    </motion.div>
  )
}

function Stamp({
  label,
  opacity,
  className,
}: {
  label: string
  opacity: MotionValue<number>
  className: string
}) {
  return (
    <motion.span
      aria-hidden
      style={{ opacity }}
      className={cn(
        'pointer-events-none absolute rounded-lg border-[3px] border-current bg-surface px-2.5 py-1 font-display text-[19px] font-extrabold uppercase tracking-[0.08em]',
        className,
      )}
    >
      {label}
    </motion.span>
  )
}
