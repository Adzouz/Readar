import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canListen, spokenText, stopSpeaking, toggleSpeaking, useSpeech } from './speech'
import { SAMPLE_ITEMS } from '@/data/sample'

const summary = { tldr: 'Claude TL;DR', points: ['One'] }
const item = { ...SAMPLE_ITEMS[0]!, summary }
const other = { ...SAMPLE_ITEMS[1]!, summary }

class FakeUtterance {
  lang = ''
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public text: string) {}
}

const synth = { speak: vi.fn<(u: FakeUtterance) => void>(), cancel: vi.fn<() => void>() }

beforeEach(() => {
  synth.speak.mockReset()
  synth.cancel.mockReset()
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  useSpeech.setState({ speakingId: null })
})
afterEach(() => vi.unstubAllGlobals())

describe('spokenText', () => {
  it('reads the title, the summary, then the key points as sentences', () => {
    expect(spokenText('Big news', { tldr: 'Something happened', points: ['One', 'Two.'] })).toBe(
      'Big news. Something happened. Key points. One. Two.',
    )
  })

  it('skips the key points when there are none', () => {
    expect(spokenText('Title?', { tldr: 'Summary.', points: [] })).toBe('Title? Summary.')
  })
})

describe('canListen', () => {
  it("only reads Claude's summary, not the feed excerpt", () => {
    expect(canListen({ summary })).toBe(true)
    expect(canListen({})).toBe(false)
  })
})

describe('toggleSpeaking', () => {
  it('stays silent on a card without a summary', () => {
    toggleSpeaking({ ...item, summary: undefined })
    expect(synth.speak).not.toHaveBeenCalled()
    expect(useSpeech.getState().speakingId).toBeNull()
  })

  it('reads a card, then stops on a second press', () => {
    toggleSpeaking(item)
    expect(synth.speak).toHaveBeenCalledOnce()
    expect(useSpeech.getState().speakingId).toBe(item.id)
    toggleSpeaking(item)
    expect(synth.speak).toHaveBeenCalledOnce()
    expect(useSpeech.getState().speakingId).toBeNull()
  })

  it('switches to another card, and the first one ending late changes nothing', () => {
    toggleSpeaking(item)
    const first = synth.speak.mock.calls[0]![0]
    toggleSpeaking(other)
    first.onend?.()
    expect(useSpeech.getState().speakingId).toBe(other.id)
  })

  it('clears the state when stopped', () => {
    toggleSpeaking(item)
    stopSpeaking()
    expect(synth.cancel).toHaveBeenCalled()
    expect(useSpeech.getState().speakingId).toBeNull()
  })
})
