import { useSyncExternalStore } from 'react'
import { useTheme } from './store'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const systemPrefersDark = () => window.matchMedia(DARK_QUERY).matches

/** The light/dark mode to render: the user's choice, or the system's when set to "system". */
export function useResolvedMode(): 'light' | 'dark' {
  const mode = useTheme((s) => s.mode)
  const dark = useSyncExternalStore(subscribe, systemPrefersDark, () => false)
  if (mode === 'system') return dark ? 'dark' : 'light'
  return mode
}
