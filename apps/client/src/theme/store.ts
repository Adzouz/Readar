import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeStyle = 'glass' | 'editorial' | 'playful'
export type ThemeMode = 'system' | 'light' | 'dark'

export const THEME_STYLES: { id: ThemeStyle; name: string; blurb: string }[] = [
  {
    id: 'glass',
    name: 'Native Glass',
    blurb: 'Feels built into macOS and iOS: frosted sidebar, colored topic icons, one clean card.',
  },
  {
    id: 'editorial',
    name: 'Editorial Calm',
    blurb: 'A daily edition you can finish: serif headlines, generous margins, a list that ends.',
  },
  {
    id: 'playful',
    name: 'Playful Deck',
    blurb: 'Bold topic colors, big emoji, springy cards. Swiping feels like a game.',
  },
]

interface ThemeState {
  style: ThemeStyle
  mode: ThemeMode
  setStyle: (style: ThemeStyle) => void
  setMode: (mode: ThemeMode) => void
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      style: 'glass',
      mode: 'system',
      setStyle: (style) => set({ style }),
      setMode: (mode) => set({ mode }),
    }),
    // index.html reads this key before first paint; keep the shape { state: { style, mode } }.
    { name: 'readar.theme' },
  ),
)
