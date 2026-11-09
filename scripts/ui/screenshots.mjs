// Captures the main screens in each style to .screenshots/ (gitignored) for a visual review.
// Needs the dev server (`pnpm dev`) and Google Chrome. Usage: pnpm ui:shots [base-url]
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

// `?offline` keeps the run off Supabase: sample cards, no throwaway anonymous users.
const base = process.argv[2] ?? 'http://localhost:1420/?offline'
const outDir = fileURLToPath(new URL('../../.screenshots/', import.meta.url))
await mkdir(outDir, { recursive: true })

const desktop = { width: 1280, height: 860 }
const phone = { width: 390, height: 844, mobile: true }
const picks = {
  topicIds: ['ai', 'dev', 'design', 'space'],
  keywords: [{ id: 'kw-strapi', keyword: 'Strapi' }],
  disabledSourceIds: ['deepmind'],
  userSources: [],
}
const done = { step: 'done', completed: true, ...picks }

const shots = [
  { name: '01-style', theme: { style: 'glass', mode: 'light' }, setup: null, ...desktop },
  {
    name: '02-topics',
    theme: { style: 'glass', mode: 'light' },
    setup: { step: 'topics', completed: false, ...picks },
    ...desktop,
  },
  {
    name: '03-sources',
    theme: { style: 'glass', mode: 'light' },
    setup: { step: 'sources', completed: false, ...picks },
    ...desktop,
  },
  {
    name: '03b-claude-dark',
    theme: { style: 'editorial', mode: 'dark' },
    setup: { step: 'claude', completed: false, ...picks },
    ...desktop,
  },
  {
    name: '04-deck-glass-light',
    theme: { style: 'glass', mode: 'light' },
    setup: done,
    ...desktop,
  },
  { name: '05-deck-glass-dark', theme: { style: 'glass', mode: 'dark' }, setup: done, ...desktop },
  {
    name: '06-deck-editorial',
    theme: { style: 'editorial', mode: 'light' },
    setup: done,
    ...desktop,
  },
  { name: '07-deck-playful', theme: { style: 'playful', mode: 'light' }, setup: done, ...desktop },
  { name: '08-deck-phone', theme: { style: 'glass', mode: 'light' }, setup: done, ...phone },
  {
    name: '09-after-like-and-expand',
    theme: { style: 'glass', mode: 'light' },
    setup: done,
    ...desktop,
    act: async (page) => {
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(600)
      await page.keyboard.press(' ')
      await page.waitForTimeout(450)
    },
  },
  {
    name: '10-empty-topic',
    theme: { style: 'glass', mode: 'light' },
    setup: done,
    ...desktop,
    act: async (page) => {
      await page.keyboard.press('2')
      await page.waitForTimeout(300)
    },
  },
]

const browser = await chromium.launch({ channel: 'chrome', headless: true })
for (const shot of shots) {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
    colorScheme: shot.theme.mode,
    isMobile: Boolean(shot.mobile),
    hasTouch: Boolean(shot.mobile),
  })
  await context.addInitScript(
    ({ theme, setup }) => {
      localStorage.setItem('readar.theme', JSON.stringify({ state: theme, version: 0 }))
      if (setup) localStorage.setItem('readar.setup', JSON.stringify({ state: setup, version: 0 }))
    },
    { theme: shot.theme, setup: shot.setup },
  )
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  if (shot.act) await shot.act(page)
  await page.screenshot({ path: `${outDir}${shot.name}.png` })
  console.log(shot.name, problems.length ? problems : 'ok')
  await context.close()
}
await browser.close()
console.log(`Screenshots in ${outDir}`)
