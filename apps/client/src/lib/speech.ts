// Read aloud with the system voices (Web Speech API): on the device, free, no extra download.
import { create } from 'zustand'
import type { AiSummary, Item } from '@/deck/types'

interface SpeechState {
  /** The card being read aloud, if any. */
  speakingId: string | null
}

export const useSpeech = create<SpeechState>()(() => ({ speakingId: null }))

export const canSpeak = (): boolean => typeof globalThis.speechSynthesis !== 'undefined'

/** Only Claude's summary is read aloud, never the feed excerpt. */
export const canListen = (item: Pick<Item, 'summary'>): boolean => item.summary !== undefined

/** What is read for a summarized card: its title, Claude's summary, then the key points. */
export function spokenText(title: string, summary: AiSummary): string {
  const sentence = (text: string) => {
    const trimmed = text.trim()
    return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`
  }
  const parts = [sentence(title), sentence(summary.tldr)]
  if (summary.points.length) parts.push('Key points.', ...summary.points.map(sentence))
  return parts.join(' ')
}

export function stopSpeaking(): void {
  if (!canSpeak()) return
  globalThis.speechSynthesis.cancel()
  useSpeech.setState({ speakingId: null })
}

/** Reads a card aloud, or stops when it is the one already being read. */
export function toggleSpeaking(item: Item): void {
  if (!canSpeak() || !item.summary) return
  const { speakingId } = useSpeech.getState()
  globalThis.speechSynthesis.cancel()
  if (speakingId === item.id) {
    useSpeech.setState({ speakingId: null })
    return
  }
  const utterance = new SpeechSynthesisUtterance(spokenText(item.title, item.summary))
  utterance.lang = 'en-US'
  const done = () => {
    // A later card may have started since: only clear our own.
    if (useSpeech.getState().speakingId === item.id) useSpeech.setState({ speakingId: null })
  }
  utterance.onend = done
  utterance.onerror = done
  useSpeech.setState({ speakingId: item.id })
  globalThis.speechSynthesis.speak(utterance)
}
