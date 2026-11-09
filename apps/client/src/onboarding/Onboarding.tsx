import { ClaudeStep } from './ClaudeStep'
import { SourcePicker } from './SourcePicker'
import { useSetup } from './store'
import { StylePicker } from './StylePicker'
import { TopicPicker } from './TopicPicker'

/** First-run setup (style, topics, sources, Claude). Topics and sources reopen later as edits. */
export function Onboarding() {
  const step = useSetup((s) => s.step)
  if (step === 'topics') return <TopicPicker />
  if (step === 'sources') return <SourcePicker />
  if (step === 'claude') return <ClaudeStep />
  return <StylePicker />
}
