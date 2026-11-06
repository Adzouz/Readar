import { AppWindow, Globe } from 'lucide-react'
import { useState } from 'react'
import { appLink, confirmAuthLink, useAuthLink } from '@/sync/authLink'

type Phase = 'choose' | 'opened' | 'signing-in' | 'done'

/** Web: the email's sign-in link landed here. Hand off to the installed app, or sign in here. */
export function AuthLinkPrompt() {
  const link = useAuthLink((s) => s.link)
  const [phase, setPhase] = useState<Phase>('choose')
  const [error, setError] = useState('')
  if (!link) return null

  const close = () => useAuthLink.setState({ link: null })

  const openApp = () => {
    window.location.href = appLink(link)
    setPhase('opened')
  }

  const continueHere = async () => {
    setPhase('signing-in')
    const failure = await confirmAuthLink(link)
    if (failure) {
      setError(failure)
      setPhase('choose')
    } else {
      setPhase('done')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-link-title"
        className="relative max-h-full w-full max-w-[400px] overflow-y-auto rounded-card bg-surface p-5 text-ink shadow-card"
      >
        <h2 id="auth-link-title" className="font-display text-[20px] font-bold">
          {phase === 'done' ? 'You’re signed in' : 'Sign in to Readar'}
        </h2>
        <p className="mt-1.5 text-[14px] text-muted">
          {phase === 'done'
            ? 'Your topics and lists now sync across your devices.'
            : phase === 'opened'
              ? 'If Readar opened and signed you in, you can close this tab. Nothing happened? The app may not be installed on this computer: continue in the browser instead.'
              : 'Where do you want to use Readar?'}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-nope">
            {error}
          </p>
        )}
        <div className="mt-4 grid gap-2">
          {phase === 'done' ? (
            <button
              type="button"
              onClick={close}
              className="rounded-ui bg-ink px-4 py-2.5 text-[14px] font-semibold text-app"
            >
              Continue
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={openApp}
                disabled={phase === 'signing-in'}
                className="flex items-center justify-center gap-2 rounded-ui bg-ink px-4 py-2.5 text-[14px] font-semibold text-app disabled:opacity-40"
              >
                <AppWindow size={16} aria-hidden />
                Open in the Readar app
              </button>
              <button
                type="button"
                onClick={() => void continueHere()}
                disabled={phase === 'signing-in'}
                className="flex items-center justify-center gap-2 rounded-ui border border-line px-4 py-2.5 text-[14px] font-semibold hover:bg-hover disabled:opacity-40"
              >
                <Globe size={16} aria-hidden />
                {phase === 'signing-in' ? 'Signing in…' : 'Continue in this browser'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
