import type { Item, Topic } from '@/deck/types'

// Sample content for Phase 0. No card comes with a summary: only Claude writes those.
// Sources and articles are fictional; links go to example.com.
// Topic ids match the catalog (ai, design, space) and the keyword watch id for "Strapi", so
// these cards show up when the user follows those topics.

const ai: Topic = { id: 'ai', name: 'AI & Machine Learning', emoji: '🤖', hue: '#4F6BED' }
const design: Topic = { id: 'design', name: 'Design', emoji: '🎨', hue: '#E0663A' }
const space: Topic = { id: 'space', name: 'Space & Science', emoji: '🚀', hue: '#1E9E8A' }
const strapi: Topic = {
  id: 'kw-strapi',
  name: '“Strapi”',
  shortName: 'Strapi',
  emoji: '🔎',
  hue: '#7A5AF8',
  keyword: true,
}

const item = (topic: Topic, index: number, fields: Omit<Item, 'id' | 'topicId'>): Item => ({
  id: `${topic.id}-${index}`,
  topicId: topic.id,
  ...fields,
})

const glassSlider = item(design, 0, {
  type: 'article',
  source: 'Pixel & Grid',
  url: 'https://example.com/pixel-and-grid/glass-slider',
  age: '1h',
  length: '6 min read',
  title: 'Designing for the glass slider: readable UI at every transparency level',
  excerpt:
    'Now that people choose how much glass they see, text contrast has to hold from fully clear to fully frosted.',
  why: 'Matches: UI design · macOS',
  signal: 3,
  alsoCoveredBy: 0,
  colors: ['#FFB17A', '#B9A7FF'],
})

export const SAMPLE_ITEMS: Item[] = [
  item(ai, 0, {
    type: 'article',
    source: 'Northwind Engineering',
    url: 'https://example.com/northwind/on-device-summaries',
    age: '2h',
    length: '7 min read',
    title: 'We moved summarization on-device. Here is what broke.',
    excerpt:
      'Latency dropped from 1.8 s to 300 ms, but cold starts and battery drain became the new problems.',
    why: 'Matches: on-device AI · mobile',
    signal: 3,
    alsoCoveredBy: 0,
    colors: ['#8C9BFF', '#FFB38A'],
  }),
  item(ai, 1, {
    type: 'video',
    source: 'Frame by Frame',
    url: 'https://example.com/frame-by-frame/tauri-vs-electron',
    age: '5h',
    length: '14:32',
    title: 'Tauri 2 vs Electron: the same app built twice',
    excerpt:
      'A side-by-side build of one note-taking app. The trade-offs come down to bundle size, memory use and rendering consistency.',
    why: 'Matches: desktop apps · Rust',
    signal: 2,
    alsoCoveredBy: 0,
    colors: ['#5ED6C8', '#6A78FF'],
  }),
  item(ai, 2, {
    type: 'article',
    source: 'Open Wire',
    url: 'https://example.com/open-wire/small-model-leader',
    age: '3h',
    length: '4 min read',
    title: 'A new open-weight model leads the small-model coding benchmarks',
    excerpt:
      'Four outlets covered the release. The gains are mostly on coding tasks, and the license allows commercial use.',
    why: 'Matches: LLMs · open source',
    signal: 2,
    alsoCoveredBy: 4,
    colors: ['#FFD27A', '#7FA6FF'],
  }),
  item(ai, 3, {
    type: 'thread',
    source: 'Byteboard',
    url: 'https://example.com/byteboard/keeping-up',
    age: '38m',
    length: '214 replies',
    title: 'How do you keep up with tech news without drowning?',
    excerpt:
      'Most replies settle on fewer sources, one daily check-in and aggressive unsubscribing. A few swear by feeds plus filters.',
    why: 'Matches: productivity · tech',
    signal: 2,
    alsoCoveredBy: 0,
    colors: ['#FFC46B', '#FF7E95'],
  }),
  item(ai, 4, {
    type: 'podcast',
    source: 'The Render Loop',
    url: 'https://example.com/render-loop/personal-feeds',
    age: '1d',
    length: '38 min',
    title: 'Ranking a personal feed with embeddings, explained in one episode',
    excerpt:
      'How to score articles against a topic vector, then nudge that vector with every like and dismiss.',
    why: 'Matches: AI · recommendation',
    signal: 3,
    alsoCoveredBy: 0,
    colors: ['#9BE7B8', '#5B8CFF'],
  }),
  glassSlider,
  item(design, 1, {
    type: 'video',
    source: 'Kerning Club',
    url: 'https://example.com/kerning-club/variable-axes',
    age: '6h',
    length: '9:05',
    title: 'Five variable-font axes worth using in product UI',
    excerpt:
      'Weight and optical size are the safe bets. Width and grade help dense dashboards and dark mode.',
    why: 'Matches: typography',
    signal: 2,
    alsoCoveredBy: 0,
    colors: ['#FF9AA8', '#FFD08A'],
  }),
  item(design, 2, {
    type: 'article',
    source: 'Onboard Lab',
    url: 'https://example.com/onboard-lab/value-in-a-minute',
    age: '2d',
    length: '9 min read',
    title: 'Teardown: 12 apps that reach value in under a minute',
    excerpt:
      'The best ones ask for interests first, show real content right away, and leave sign-up for later.',
    why: 'Matches: onboarding · product',
    signal: 3,
    alsoCoveredBy: 0,
    colors: ['#FFC9A0', '#8FD3FF'],
  }),
  item(space, 0, {
    type: 'article',
    source: 'Orbit Weekly',
    url: 'https://example.com/orbit-weekly/small-landers',
    age: '4h',
    length: '8 min read',
    title: 'Small, cheap and many: the new playbook for lunar landers',
    excerpt:
      'Agencies are trading one flagship mission for several low-cost landers, accepting more failures in exchange for faster learning.',
    why: 'Matches: space exploration',
    signal: 2,
    alsoCoveredBy: 0,
    colors: ['#7FD8C9', '#6C7BFF'],
  }),
  item(space, 1, {
    type: 'video',
    source: 'Small Planet',
    url: 'https://example.com/small-planet/mirror-segments',
    age: '1d',
    length: '18:47',
    title: 'How a space telescope keeps its mirror segments aligned',
    excerpt:
      "Tiny motors nudge each segment by a fraction of a hair's width, guided by images of a bright star.",
    why: 'Matches: astronomy',
    signal: 2,
    alsoCoveredBy: 0,
    colors: ['#8AB4FF', '#C6A2FF'],
  }),
  item(strapi, 0, {
    type: 'article',
    source: "A Dev's Notebook",
    url: 'https://example.com/devs-notebook/strapi-5-migration',
    age: '7h',
    length: '5 min read',
    title: 'Migrating a content model to Strapi 5, step by step',
    excerpt:
      'A log of moving 40 content types, with each gotcha hit along the way and how it was fixed.',
    why: 'Keyword: “Strapi” in the title',
    signal: 3,
    alsoCoveredBy: 0,
    colors: ['#B6A4FF', '#7FD0FF'],
  }),
  item(strapi, 1, {
    type: 'thread',
    source: 'Byteboard',
    url: 'https://example.com/byteboard/multilingual-cms',
    age: '1d',
    length: '96 replies',
    title: 'Which headless CMS do you use for multilingual sites?',
    excerpt:
      'A long comparison thread. Strapi comes up often, mostly about its localization setup and self-hosting.',
    why: 'Keyword: “Strapi” in 14 replies',
    signal: 2,
    alsoCoveredBy: 0,
    colors: ['#C7B6FF', '#FFC2A1'],
  }),
]

/** Card shown in the onboarding style previews. */
export const PREVIEW = { topic: design, item: glassSlider }
