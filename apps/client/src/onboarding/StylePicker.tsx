import { PREVIEW } from '@/data/sample'
import { ItemCard } from '@/deck/cards'
import { THEME_STYLES, useTheme, type ThemeStyle } from '@/theme/store'
import { ThemeScope } from '@/theme/ThemeScope'
import { useResolvedMode } from '@/theme/useResolvedMode'
import { Frame, QuietButton } from './Frame'
import { useSetup } from './store'

/** Onboarding step 1: the three styles side by side, each rendering the same sample card. */
export function StylePicker() {
  const setStyle = useTheme((s) => s.setStyle)
  const goTo = useSetup((s) => s.goTo)
  const mode = useResolvedMode()

  const choose = (style: ThemeStyle) => {
    setStyle(style)
    goTo('topics')
  }

  return (
    <Frame
      step={1}
      title="Pick the style that fits you"
      subtitle="Same app, same features, three personalities. You can switch any time in Settings."
      footer={
        <>
          <p className="text-[13px] text-muted">Welcome to Readar</p>
          <QuietButton onClick={() => choose('glass')} className="ml-auto">
            Skip and use Native Glass
          </QuietButton>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-3">
        {THEME_STYLES.map((style) => (
          <section
            key={style.id}
            className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-3"
          >
            <ThemeScope
              style={style.id}
              mode={mode}
              className="app-bg relative h-[340px] overflow-hidden rounded-[16px] p-5 [mask-image:linear-gradient(to_bottom,black_82%,transparent)]"
            >
              <ItemCard item={PREVIEW.item} topic={PREVIEW.topic} expanded={false} />
            </ThemeScope>
            <div className="flex flex-1 flex-col gap-1 px-1">
              <h2 className="text-[17px] font-bold">{style.name}</h2>
              <p className="text-[14px] text-muted">{style.blurb}</p>
            </div>
            <button
              type="button"
              onClick={() => choose(style.id)}
              className="rounded-ui bg-ink px-4 py-2.5 text-[14px] font-semibold text-app"
            >
              Use {style.name}
            </button>
          </section>
        ))}
      </div>
    </Frame>
  )
}
