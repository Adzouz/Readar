/** True inside the Tauri shell (Mac or iPhone app), false in a browser. */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Opens a link in the default browser (apps) or a new tab (web). */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

export type ShareResult = 'shared' | 'copied' | 'failed'

/**
 * Shares an article's own link. Web Share where the browser has it, otherwise copy.
 * The native share sheet in the Mac and iPhone apps comes with the Phase 0 iOS spike.
 */
export async function shareLink(title: string, url: string): Promise<ShareResult> {
  if (!isTauri() && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url })
      return 'shared'
    } catch {
      // Cancelled or blocked: fall back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
