import { Check, X } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '@/lib/cn'
import { useSetup } from '@/onboarding/store'
import { THEME_STYLES, useTheme, type ThemeMode } from '@/theme/store'

const MODES: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'Match system' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

export function Settings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const style = useTheme((s) => s.style)
  const mode = useTheme((s) => s.mode)
  const setStyle = useTheme((s) => s.setStyle)
  const setMode = useTheme((s) => s.setMode)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-[440px] rounded-card bg-surface p-5 text-ink shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="font-display text-[20px] font-bold">
            Settings
          </h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full hover:bg-hover"
          >
            <X size={16} />
          </button>
        </div>

        <h3 className="mt-4 mb-2 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">
          Style
        </h3>
        <div role="radiogroup" aria-label="Style" className="grid gap-2">
          {THEME_STYLES.map((option) => {
            const checked = style === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setStyle(option.id)}
                className={cn(
                  'flex items-start gap-3 rounded-ui border px-3 py-2.5 text-left',
                  checked ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full border',
                    checked ? 'border-accent bg-accent text-white' : 'border-line',
                  )}
                >
                  {checked && <Check size={11} strokeWidth={3} />}
                </span>
                <span>
                  <b className="block text-[14px]">{option.name}</b>
                  <span className="text-[13px] text-muted">{option.blurb}</span>
                </span>
              </button>
            )
          })}
        </div>

        <h3 className="mt-4 mb-2 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">
          Appearance
        </h3>
        <div
          role="radiogroup"
          aria-label="Appearance"
          className="grid grid-cols-3 gap-1 rounded-ui bg-surface-2 p-1"
        >
          {MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={mode === option.id}
              onClick={() => setMode(option.id)}
              className={cn(
                'rounded-ui px-2 py-1.5 text-[13px]',
                mode === option.id ? 'bg-surface font-semibold shadow-sm' : 'text-muted',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <h3 className="mt-4 mb-2 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">
          Content
        </h3>
        <button
          type="button"
          onClick={() => {
            onClose()
            useSetup.getState().goTo('topics')
          }}
          className="w-full rounded-ui border border-line px-3 py-2.5 text-left text-[14px] font-semibold hover:bg-hover"
        >
          Edit topics and sources
        </button>

        <p className="mt-4 rounded-ui bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
          Claude API key: coming next. It will stay on this device.
        </p>
      </div>
    </div>
  )
}
