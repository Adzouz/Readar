import { ClaudeKey } from '@/claude/ClaudeKey'
import { Frame, QuietButton } from './Frame'
import { useSetup } from './store'

/** Onboarding step 4: the user's own Claude key for summaries. Skippable. */
export function ClaudeStep() {
  const goTo = useSetup((s) => s.goTo)
  const finish = useSetup((s) => s.finish)
  return (
    <Frame
      step={4}
      title="Connect Claude for summaries"
      subtitle="Readar can ask Claude for a short summary of any card. You bring your own key from the Claude Console and pay Anthropic directly, only for the cards you summarize."
      footer={
        <>
          <QuietButton onClick={() => goTo('sources')}>Back</QuietButton>
          <QuietButton onClick={finish} className="ml-auto">
            Skip for now
          </QuietButton>
        </>
      }
    >
      <div className="max-w-[520px] rounded-card border border-line bg-surface p-4">
        <ClaudeKey onConnected={finish} />
      </div>
      <p className="mt-4 max-w-[520px] text-[13px] text-muted">
        Without a key, cards show the feed's own excerpt. You can connect Claude later in Settings.
      </p>
    </Frame>
  )
}
