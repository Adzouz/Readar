import { Cloud, CloudOff, Mail } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { signOut } from '@/sync'
import { sendCode, useAccount, verifyCode } from '@/sync/account'

const INPUT =
  'min-w-0 flex-1 rounded-ui border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent'
const BUTTON =
  'shrink-0 rounded-ui bg-ink px-3 py-2 text-[14px] font-semibold text-app disabled:opacity-40'

/** Settings section: sync status and email sign-in with a one-time code. */
export function Account() {
  const status = useAccount((s) => s.status)
  const email = useAccount((s) => s.email)

  if (status === 'local' || status === 'offline' || status === 'connecting') {
    const text = {
      local: 'Sync is off in this build. Your setup stays on this device.',
      offline: 'Offline. Your changes stay on this device and sync when Readar reconnects.',
      connecting: 'Connecting…',
    }[status]
    return (
      <p className="flex items-start gap-2 rounded-ui bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
        <CloudOff size={15} className="mt-0.5 shrink-0" aria-hidden />
        {text}
      </p>
    )
  }

  if (email) {
    return (
      <div className="grid gap-2 rounded-ui bg-surface-2 px-3 py-2.5 text-[13px]">
        <p className="flex items-start gap-2 text-muted">
          <Cloud size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span>
            Signed in as <b className="break-all text-ink">{email}</b>. Topics, sources and lists
            sync across your devices.
          </span>
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="justify-self-start rounded-ui px-2 py-1 text-[13px] font-medium text-muted hover:bg-hover hover:text-ink"
        >
          Sign out of this device
        </button>
      </div>
    )
  }

  return <SignIn />
}

function SignIn() {
  const emailId = useId()
  const codeId = useId()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const requestCode = async (event: FormEvent) => {
    event.preventDefault()
    const address = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter a valid email address.')
      return
    }
    setBusy(true)
    const failure = await sendCode(address)
    setBusy(false)
    if (failure) setError(failure)
    else setSentTo(address)
  }

  const confirm = async (event: FormEvent) => {
    event.preventDefault()
    if (!sentTo) return
    setBusy(true)
    const failure = await verifyCode(sentTo, code.replace(/\s/g, ''))
    setBusy(false)
    if (failure) setError(failure)
  }

  return (
    <div className="grid gap-2 rounded-ui bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
      <p className="flex items-start gap-2">
        <Mail size={15} className="mt-0.5 shrink-0" aria-hidden />
        {sentTo ? (
          <span>
            We sent a code to <b className="break-all text-ink">{sentTo}</b>. Enter it here, or use
            the link in the email.
          </span>
        ) : (
          <span>Sign in with your email to keep your topics and lists on all your devices.</span>
        )}
      </p>
      {sentTo ? (
        <form onSubmit={confirm} className="flex gap-2">
          <label htmlFor={codeId} className="sr-only">
            Code from the email
          </label>
          <input
            id={codeId}
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
              setError('')
            }}
            placeholder="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`${INPUT} tracking-[0.2em] tabular-nums`}
          />
          <button type="submit" disabled={busy || code.trim().length < 6} className={BUTTON}>
            Sign in
          </button>
        </form>
      ) : (
        <form onSubmit={requestCode} className="flex gap-2">
          <label htmlFor={emailId} className="sr-only">
            Email
          </label>
          <input
            id={emailId}
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setError('')
            }}
            placeholder="you@example.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            className={INPUT}
          />
          <button type="submit" disabled={busy || !email.trim()} className={BUTTON}>
            Send code
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-[12.5px] text-nope">
          {error}
        </p>
      )}
      {sentTo && (
        <button
          type="button"
          onClick={() => {
            setSentTo(null)
            setCode('')
            setError('')
          }}
          className="justify-self-start rounded-ui px-2 py-1 text-[13px] font-medium hover:bg-hover hover:text-ink"
        >
          Use another email
        </button>
      )}
    </div>
  )
}
