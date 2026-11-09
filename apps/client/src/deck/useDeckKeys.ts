import { useEffect } from 'react'
import type { DeckActions } from './actions'
import { deckStore } from './store'

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * Keyboard map, identical in every theme:
 * ← / h dismiss · → / l like · ↑ / k read later · Space full summary · ↵ / o open
 * s share · a summarize · ⌘Z / u / Backspace undo · 1–9 switch topic · ⌘, settings
 */
export function useDeckKeys(actions: DeckActions, onSettings: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target && (target.isContentEditable || TYPING.has(target.tagName))) return

      const command = event.metaKey || event.ctrlKey
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        actions.undo()
        return
      }
      if (command && event.key === ',') {
        event.preventDefault()
        onSettings()
        return
      }
      if (command || event.altKey) return

      // Let focused buttons keep their own Space/Enter behavior.
      const onButton = target?.closest('button') !== null && target !== null
      switch (event.key) {
        case 'ArrowRight':
        case 'l':
          event.preventDefault()
          actions.act('like')
          break
        case 'ArrowLeft':
        case 'h':
          event.preventDefault()
          actions.act('nope')
          break
        case 'ArrowUp':
        case 'k':
          event.preventDefault()
          actions.act('later')
          break
        case ' ':
          if (onButton) return
          event.preventDefault()
          deckStore.getState().toggleExpanded()
          break
        case 'Enter':
          if (onButton) return
          event.preventDefault()
          actions.open()
          break
        case 'o':
          actions.open()
          break
        case 's':
          actions.share()
          break
        case 'a':
          actions.summarize()
          break
        case 'u':
        case 'Backspace':
          event.preventDefault()
          actions.undo()
          break
        default:
          if (/^[1-9]$/.test(event.key)) {
            const topic = deckStore.getState().topics[Number(event.key) - 1]
            if (topic) deckStore.getState().select({ kind: 'topic', id: topic.id })
          }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions, onSettings, enabled])
}
