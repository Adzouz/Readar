import { createContext, useContext, type ReactNode } from 'react'
import type { ThemeStyle } from './store'

const StyleContext = createContext<ThemeStyle>('glass')

/** Style of the closest ThemeScope. Onboarding previews render other styles than the app. */
export const useStyle = (): ThemeStyle => useContext(StyleContext)

interface ThemeScopeProps {
  style: ThemeStyle
  mode: 'light' | 'dark'
  className?: string
  children: ReactNode
}

/** Applies a theme's tokens to a subtree and tells variant components which style to render. */
export function ThemeScope({ style, mode, className, children }: ThemeScopeProps) {
  return (
    <StyleContext value={style}>
      <div data-style={style} data-mode={mode} className={className}>
        {children}
      </div>
    </StyleContext>
  )
}
