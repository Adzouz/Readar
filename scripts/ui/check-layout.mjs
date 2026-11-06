// Layout regression check: every screen, in every style, at desktop and phone size, must fit the
// window (no page-level overflow). The app scrolls inside its own areas, never the page; overflow
// shows up as a double scrollbar in the Mac app (WKWebView) even when screenshots look fine.
//
// Needs the dev server (`pnpm dev`) and Google Chrome. Usage: pnpm ui:check [base-url]
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:1420'

// Persisted shapes of the theme and setup stores (localStorage keys readar.theme / readar.setup).
const picks = {
  topicIds: ['ai', 'dev', 'design', 'space', 'world', 'sports'],
  keywords: [{ id: 'kw-strapi', keyword: 'Strapi' }],
  disabledSourceIds: [],
  userSources: [],
}
const sizes = [
  { name: 'desktop', width: 1200, height: 818 },
  { name: 'phone', width: 390, height: 844 },
]
const screens = [
  { name: 'style', setup: null },
  { name: 'topics', setup: { step: 'topics', completed: false, ...picks } },
  { name: 'sources', setup: { step: 'sources', completed: false, ...picks } },
  { name: 'deck', setup: { step: 'done', completed: true, ...picks } },
  {
    name: 'liked-list',
    setup: { step: 'done', completed: true, ...picks },
    keys: ['ArrowRight'],
    click: /^Liked/,
  },
]

const browser = await chromium.launch({ channel: 'chrome', headless: true })
let failures = 0
for (const size of sizes) {
  for (const style of ['glass', 'editorial', 'playful']) {
    for (const screen of screens) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
      })
      await context.addInitScript(
        (init) => {
          localStorage.setItem(
            'readar.theme',
            JSON.stringify({ state: { style: init.style, mode: 'light' }, version: 0 }),
          )
          if (init.setup)
            localStorage.setItem('readar.setup', JSON.stringify({ state: init.setup, version: 0 }))
        },
        { style, setup: screen.setup },
      )
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(base, { waitUntil: 'networkidle' })
      await page.waitForTimeout(250)
      for (const key of screen.keys ?? []) {
        await page.keyboard.press(key)
        await page.waitForTimeout(450)
      }
      if (screen.click) {
        await page.getByRole('button', { name: screen.click }).first().click()
        await page.waitForTimeout(250)
      }
      const measured = await page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        width: document.documentElement.scrollWidth,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      }))
      const overflow =
        measured.height > measured.viewportHeight || measured.width > measured.viewportWidth
      if (overflow || errors.length) {
        failures++
        console.log('FAIL', size.name, style, screen.name, JSON.stringify({ ...measured, errors }))
      }
      await context.close()
    }
  }
}
await browser.close()
console.log(failures ? `${failures} screens failed` : 'All screens fit the window, no page errors')
process.exitCode = failures ? 1 : 0
