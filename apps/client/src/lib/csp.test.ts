import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'
import config from '../../src-tauri/tauri.conf.json'

const sha256 = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

describe('Tauri CSP', () => {
  it('allows the inline theme script in index.html by its current hash', async () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''
    expect(script).toContain('readar.theme')
    // Editing the theme script changes its hash: update script-src in tauri.conf.json to match.
    expect(config.app.security.csp['script-src']).toContain(`'sha256-${await sha256(script)}'`)
  })
})
