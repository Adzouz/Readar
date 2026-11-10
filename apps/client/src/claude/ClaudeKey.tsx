import { ExternalLink, KeyRound, ShieldAlert } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { openExternal } from '@/lib/platform'
import { Switch } from '@/lib/Switch'
import { keyStorage } from './key'
import { connectClaude, disconnectClaude, loadClaudeStatus, useClaude } from './store'
import { AHEAD, useSummaries, useSummarizeAhead } from './summaries'

const CONSOLE_KEYS_URL = 'https://console.anthropic.com/settings/keys'

/** Connect, show or remove the Claude key. Used by the onboarding step and Settings. */
export function ClaudeKey({
  onConnected,
  showAhead = false,
}: {
  onConnected?: () => void
  /** Settings also shows the "Summarize ahead" switch. */
  showAhead?: boolean
}) {
  const status = useClaude((s) => s.status)
  const hint = useClaude((s) => s.hint)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (useClaude.getState().status === 'loading') void loadClaudeStatus()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const problem = await connectClaude(draft)
    setBusy(false)
    if (problem) {
      setError(problem)
      return
    }
    setDraft('')
    onConnected?.()
  }

  if (status === 'loading') return null

  if (status === 'connected') {
    return (
      <div className="grid gap-2">
        <div className="flex items-center gap-3 rounded-ui border border-line px-3 py-2.5">
          <KeyRound size={16} aria-hidden className="shrink-0 text-muted" />
          <p className="min-w-0 flex-1 text-[14px]">
            <b>Claude connected</b>
            <span className="block text-[12.5px] text-muted">Key ending in {hint}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setError('')
              disconnectClaude().catch(() =>
                setError("Couldn't remove the key from this device. Try again."),
              )
            }}
            className="rounded-ui px-2.5 py-1.5 text-[13px] font-medium text-muted hover:bg-hover hover:text-ink"
          >
            Remove
          </button>
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-nope">
            {error}
          </p>
        )}
        {showAhead && <SummarizeAhead />}
      </div>
    )
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-2">
      <label htmlFor="claude-key" className="text-[13px] font-semibold">
        Claude API key
      </label>
      <div className="flex gap-2">
        <input
          id="claude-key"
          type="password"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'claude-key-error' : undefined}
          className="min-w-0 flex-1 rounded-ui border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="shrink-0 rounded-ui bg-ink px-4 py-2 text-[14px] font-semibold text-app disabled:opacity-35"
        >
          {busy ? 'Checking…' : 'Connect'}
        </button>
      </div>
      {error && (
        <p id="claude-key-error" role="alert" className="text-[13px] text-nope">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void openExternal(CONSOLE_KEYS_URL)}
        className="flex w-fit items-center gap-1 text-[13px] font-medium text-accent-ink hover:underline"
      >
        Create a key in the Claude Console
        <ExternalLink size={12} aria-hidden />
      </button>
      {keyStorage() === 'keychain' ? (
        <p className="text-[12.5px] text-muted">
          Saved in this device's keychain. It only leaves the device to call Claude.
        </p>
      ) : (
        <p className="flex gap-1.5 text-[12.5px] text-muted">
          <ShieldAlert size={14} aria-hidden className="mt-px shrink-0" />
          In a browser the key is kept in this site's storage, where any script on the page could
          read it. The Mac and iPhone apps keep it in the keychain.
        </p>
      )}
    </form>
  )
}

/** "Summarize ahead" switch, off by default: every summary is paid by the user's key. */
function SummarizeAhead() {
  const ahead = useSummarizeAhead((s) => s.ahead)
  const setAhead = useSummarizeAhead((s) => s.setAhead)
  const paused = useSummaries((s) => s.paused)
  return (
    <>
      <div className="flex items-start gap-3 rounded-ui border border-line px-3 py-2.5">
        <p className="min-w-0 flex-1 text-[14px]">
          <b className="block">Summarize ahead</b>
          <span className="text-[12.5px] text-muted">
            Summarizes the card on top and the next {AHEAD} as you go, so they're ready when you get
            there. Each one uses your Claude credit.
          </span>
        </p>
        <Switch checked={ahead} onChange={() => setAhead(!ahead)} label="Summarize ahead" />
      </div>
      {paused && (
        <p role="status" className="flex gap-1.5 text-[13px] text-nope">
          <ShieldAlert size={14} aria-hidden className="mt-0.5 shrink-0" />
          Summaries paused: {paused}
        </p>
      )}
    </>
  )
}
