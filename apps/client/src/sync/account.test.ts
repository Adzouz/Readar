import type { Session } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleAuthChange, setSessionLostHandler, useAccount } from './account'

const session = (email: string | null): Session =>
  ({
    user: { id: 'u1', email: email ?? undefined, is_anonymous: email === null },
  }) as Session

describe('handleAuthChange', () => {
  afterEach(() => setSessionLostHandler(null))

  it('reports that a signed-in email session was lost', () => {
    const lost = vi.fn<(hadEmail: boolean) => void>()
    setSessionLostHandler(lost)
    handleAuthChange('SIGNED_IN', session('me@example.com'))
    expect(useAccount.getState().email).toBe('me@example.com')

    handleAuthChange('SIGNED_OUT', null)
    expect(lost).toHaveBeenCalledWith(true)
    expect(useAccount.getState()).toMatchObject({ userId: null, email: null })
  })

  it('reports an anonymous session lost without an email', () => {
    const lost = vi.fn<(hadEmail: boolean) => void>()
    setSessionLostHandler(lost)
    handleAuthChange('SIGNED_IN', session(null))
    handleAuthChange('SIGNED_OUT', null)
    expect(lost).toHaveBeenCalledWith(false)
  })

  it('ignores other events', () => {
    const lost = vi.fn<(hadEmail: boolean) => void>()
    setSessionLostHandler(lost)
    handleAuthChange('TOKEN_REFRESHED', session('me@example.com'))
    expect(lost).not.toHaveBeenCalled()
  })
})
