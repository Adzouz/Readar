import { useEffect } from 'react'
import { Onboarding } from './onboarding/Onboarding'
import { useSetup } from './onboarding/store'
import { Shell } from './shell/Shell'
import { ThemeScope } from './theme/ThemeScope'
import { useTheme } from './theme/store'
import { useResolvedMode } from './theme/useResolvedMode'

export function App() {
  const style = useTheme((s) => s.style)
  const step = useSetup((s) => s.step)
  const mode = useResolvedMode()

  // Mirror the theme on <html> so the page background and form controls follow it.
  useEffect(() => {
    document.documentElement.dataset.style = style
    document.documentElement.dataset.mode = mode
  }, [style, mode])

  return (
    <ThemeScope style={style} mode={mode} className="h-full">
      {step === 'done' ? <Shell /> : <Onboarding />}
    </ThemeScope>
  )
}
