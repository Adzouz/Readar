import { useEffect } from 'react'
import { create } from 'zustand'
import { cn } from '@/lib/cn'

interface ToastState {
  message: string | null
  /** Bumped on every show, so the same message twice restarts the timer. */
  id: number
  show: (message: string) => void
  hide: () => void
}

export const useToast = create<ToastState>()((set) => ({
  message: null,
  id: 0,
  show: (message) => set((state) => ({ message, id: state.id + 1 })),
  hide: () => set({ message: null }),
}))

export function Toast() {
  const message = useToast((s) => s.message)
  const id = useToast((s) => s.id)
  const hide = useToast((s) => s.hide)

  // Every show() bumps the id, which restarts the timer even for a repeated message.
  useEffect(() => {
    if (id === 0) return
    const timer = window.setTimeout(hide, 1800)
    return () => window.clearTimeout(timer)
  }, [id, hide])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed top-[max(1.25rem,env(safe-area-inset-top))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[13px] whitespace-nowrap text-app shadow-lg transition-all duration-200',
        message ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
      )}
    >
      {message}
    </div>
  )
}
