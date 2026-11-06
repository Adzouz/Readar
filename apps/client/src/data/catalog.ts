// Starter catalog for onboarding: topics with suggested sources.
// Every feed is checked with `pnpm check:feeds` before it ships; drop or fix any that fail.
// This file is standalone (no imports) so Node can run the checker against it directly.

export type SourceKind = 'feed' | 'youtube' | 'podcast' | 'search'

export interface CatalogSource {
  id: string
  name: string
  /** Domain shown under the name. */
  site: string
  /** RSS or Atom feed the fetch worker will read. */
  feed: string
  kind: SourceKind
}

export interface CatalogTopic {
  id: string
  name: string
  shortName?: string
  emoji: string
  /** Signature color of the topic. */
  hue: string
  /** What the topic covers, shown on the onboarding tile. */
  covers: string
  sources: CatalogSource[]
}

const feed = (id: string, name: string, site: string, url: string): CatalogSource => ({
  id,
  name,
  site,
  feed: url,
  kind: 'feed',
})

const youtube = (id: string, name: string, channelId: string): CatalogSource => ({
  id,
  name,
  site: 'youtube.com',
  feed: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
  kind: 'youtube',
})

const podcast = (id: string, name: string, site: string, url: string): CatalogSource => ({
  id,
  name,
  site,
  feed: url,
  kind: 'podcast',
})

export const CATALOG: CatalogTopic[] = [
  {
    id: 'ai',
    name: 'AI & Machine Learning',
    shortName: 'AI',
    emoji: '🤖',
    hue: '#4F6BED',
    covers: 'LLMs · Agents · Research · Tools',
    sources: [
      feed(
        'simonwillison',
        "Simon Willison's Weblog",
        'simonwillison.net',
        'https://simonwillison.net/atom/everything/',
      ),
      feed(
        'huggingface',
        'Hugging Face Blog',
        'huggingface.co',
        'https://huggingface.co/blog/feed.xml',
      ),
      feed(
        'techreview',
        'MIT Technology Review',
        'technologyreview.com',
        'https://www.technologyreview.com/feed/',
      ),
      feed(
        'verge-ai',
        'The Verge · AI',
        'theverge.com',
        'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
      ),
      feed(
        'deepmind',
        'Google DeepMind',
        'deepmind.google',
        'https://deepmind.google/blog/rss.xml',
      ),
      youtube('twominutepapers', 'Two Minute Papers', 'UCbfYPyITQ-7l4upoX8nvctg'),
      podcast('hardfork', 'Hard Fork', 'nytimes.com', 'https://feeds.simplecast.com/l2i9YnTd'),
    ],
  },
  {
    id: 'dev',
    name: 'Software Development',
    shortName: 'Dev',
    emoji: '💻',
    hue: '#0EA5E9',
    covers: 'Web · Mobile · DevOps · Open source',
    sources: [
      feed('hackernews', 'Hacker News', 'news.ycombinator.com', 'https://hnrss.org/frontpage'),
      feed(
        'smashing',
        'Smashing Magazine',
        'smashingmagazine.com',
        'https://www.smashingmagazine.com/feed/',
      ),
      feed('githubblog', 'The GitHub Blog', 'github.blog', 'https://github.blog/feed/'),
      feed('lobsters', 'Lobsters', 'lobste.rs', 'https://lobste.rs/rss'),
      feed('devto', 'DEV Community', 'dev.to', 'https://dev.to/feed'),
      youtube('fireship', 'Fireship', 'UCsBjURrPoezykLs9EqgamOA'),
      podcast('syntax', 'Syntax', 'syntax.fm', 'https://feed.syntax.fm/rss'),
    ],
  },
  {
    id: 'apple',
    name: 'Apple & Gadgets',
    shortName: 'Apple',
    emoji: '🍏',
    hue: '#64748B',
    covers: 'Mac · iPhone · Wearables · Smart home',
    sources: [
      feed('macrumors', 'MacRumors', 'macrumors.com', 'https://feeds.macrumors.com/MacRumors-All'),
      feed('9to5mac', '9to5Mac', '9to5mac.com', 'https://9to5mac.com/feed/'),
      feed('macstories', 'MacStories', 'macstories.net', 'https://www.macstories.net/feed/'),
      feed('sixcolors', 'Six Colors', 'sixcolors.com', 'https://sixcolors.com/feed/'),
      feed(
        'daringfireball',
        'Daring Fireball',
        'daringfireball.net',
        'https://daringfireball.net/feeds/main',
      ),
      youtube('mkbhd', 'Marques Brownlee', 'UCBJycsmduvYEL83R_U4JriQ'),
    ],
  },
  {
    id: 'design',
    name: 'Design',
    emoji: '🎨',
    hue: '#E0663A',
    covers: 'UI/UX · Product · Typography · Motion',
    sources: [
      feed('nngroup', 'Nielsen Norman Group', 'nngroup.com', 'https://www.nngroup.com/feed/rss/'),
      feed('uxcollective', 'UX Collective', 'uxdesign.cc', 'https://uxdesign.cc/feed'),
      feed('sidebar', 'Sidebar', 'sidebar.io', 'https://sidebar.io/feed.xml'),
      feed('csstricks', 'CSS-Tricks', 'css-tricks.com', 'https://css-tricks.com/feed/'),
    ],
  },
  {
    id: 'space',
    name: 'Space & Science',
    shortName: 'Science',
    emoji: '🚀',
    hue: '#1E9E8A',
    covers: 'Space · Physics · Biology · Health research',
    sources: [
      feed(
        'quanta',
        'Quanta Magazine',
        'quantamagazine.org',
        'https://www.quantamagazine.org/feed/',
      ),
      feed('nasa', 'NASA', 'nasa.gov', 'https://www.nasa.gov/feed/'),
      feed(
        'ars-science',
        'Ars Technica · Science',
        'arstechnica.com',
        'https://feeds.arstechnica.com/arstechnica/science',
      ),
      feed('spacecom', 'Space.com', 'space.com', 'https://www.space.com/feeds.xml'),
      feed(
        'sciencedaily',
        'ScienceDaily',
        'sciencedaily.com',
        'https://www.sciencedaily.com/rss/top/science.xml',
      ),
      youtube('kurzgesagt', 'Kurzgesagt', 'UCsXVk37bltHxD1rDPwtNM8Q'),
      youtube('veritasium', 'Veritasium', 'UCHnyfMqiRRG1u-2MsSQLbXA'),
    ],
  },
  {
    id: 'world',
    name: 'World News',
    shortName: 'World',
    emoji: '🌍',
    hue: '#3B82F6',
    covers: 'Europe · Americas · Asia · Politics',
    sources: [
      feed(
        'bbc-world',
        'BBC News · World',
        'bbc.co.uk',
        'https://feeds.bbci.co.uk/news/world/rss.xml',
      ),
      feed(
        'guardian-world',
        'The Guardian · World',
        'theguardian.com',
        'https://www.theguardian.com/world/rss',
      ),
      feed('npr', 'NPR News', 'npr.org', 'https://feeds.npr.org/1001/rss.xml'),
      feed('aljazeera', 'Al Jazeera', 'aljazeera.com', 'https://www.aljazeera.com/xml/rss/all.xml'),
      feed('france24-en', 'France 24', 'france24.com', 'https://www.france24.com/en/rss'),
    ],
  },
  {
    id: 'business',
    name: 'Business & Startups',
    shortName: 'Business',
    emoji: '📈',
    hue: '#16A34A',
    covers: 'Funding · Founders · Product · Strategy',
    sources: [
      feed('techcrunch', 'TechCrunch', 'techcrunch.com', 'https://techcrunch.com/feed/'),
      feed('stratechery', 'Stratechery', 'stratechery.com', 'https://stratechery.com/feed/'),
      feed(
        'lenny',
        "Lenny's Newsletter",
        'lennysnewsletter.com',
        'https://www.lennysnewsletter.com/feed',
      ),
      feed(
        'ycombinator',
        'Y Combinator Blog',
        'ycombinator.com',
        'https://www.ycombinator.com/blog/rss/',
      ),
      podcast('acquired', 'Acquired', 'acquired.fm', 'https://feeds.transistor.fm/acquired'),
    ],
  },
  {
    id: 'money',
    name: 'Money & Investing',
    shortName: 'Money',
    emoji: '💰',
    hue: '#CA8A04',
    covers: 'Markets · Personal finance · Crypto · Economy',
    sources: [
      feed(
        'cnbc',
        'CNBC',
        'cnbc.com',
        'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',
      ),
      feed(
        'marketwatch',
        'MarketWatch',
        'marketwatch.com',
        'https://feeds.content.dowjones.io/public/rss/mw_topstories',
      ),
      feed(
        'economist-finance',
        'The Economist · Finance',
        'economist.com',
        'https://www.economist.com/finance-and-economics/rss.xml',
      ),
      feed(
        'coindesk',
        'CoinDesk',
        'coindesk.com',
        'https://www.coindesk.com/arc/outboundfeeds/rss/',
      ),
      youtube('benfelix', 'Ben Felix', 'UCDXTQ8nWmx_EhZ2v-kp7QxA'),
    ],
  },
  {
    id: 'climate',
    name: 'Climate & Energy',
    shortName: 'Climate',
    emoji: '🌱',
    hue: '#22C55E',
    covers: 'EVs · Renewables · Policy · Weather',
    sources: [
      feed('carbonbrief', 'Carbon Brief', 'carbonbrief.org', 'https://www.carbonbrief.org/feed/'),
      feed('electrek', 'Electrek', 'electrek.co', 'https://electrek.co/feed/'),
      feed('grist', 'Grist', 'grist.org', 'https://grist.org/feed/'),
      feed(
        'insideclimate',
        'Inside Climate News',
        'insideclimatenews.org',
        'https://insideclimatenews.org/feed/',
      ),
      feed('canarymedia', 'Canary Media', 'canarymedia.com', 'https://www.canarymedia.com/rss.rss'),
    ],
  },
  {
    id: 'gaming',
    name: 'Gaming',
    emoji: '🎮',
    hue: '#8B5CF6',
    covers: 'PC · Consoles · Indie · Esports',
    sources: [
      feed('polygon', 'Polygon', 'polygon.com', 'https://www.polygon.com/feed/'),
      feed('eurogamer', 'Eurogamer', 'eurogamer.net', 'https://www.eurogamer.net/feed'),
      feed(
        'rps',
        'Rock Paper Shotgun',
        'rockpapershotgun.com',
        'https://www.rockpapershotgun.com/feed',
      ),
      feed('pcgamer', 'PC Gamer', 'pcgamer.com', 'https://www.pcgamer.com/rss/'),
      youtube('gmtk', "Game Maker's Toolkit", 'UCqJ-Xo29CKyLTjn6z2XwYAw'),
    ],
  },
  {
    id: 'movies',
    name: 'Movies & TV',
    shortName: 'Movies',
    emoji: '🎬',
    hue: '#EF4444',
    covers: 'Releases · Reviews · Streaming · Trailers',
    sources: [
      feed('variety', 'Variety', 'variety.com', 'https://variety.com/feed/'),
      feed('indiewire', 'IndieWire', 'indiewire.com', 'https://www.indiewire.com/feed/'),
      feed('slashfilm', '/Film', 'slashfilm.com', 'https://www.slashfilm.com/feed/'),
      feed('collider', 'Collider', 'collider.com', 'https://collider.com/feed/'),
      feed(
        'guardian-film',
        'The Guardian · Film',
        'theguardian.com',
        'https://www.theguardian.com/film/rss',
      ),
    ],
  },
  {
    id: 'music',
    name: 'Music',
    emoji: '🎵',
    hue: '#EC4899',
    covers: 'New releases · Live · Production · Gear',
    sources: [
      feed('pitchfork', 'Pitchfork', 'pitchfork.com', 'https://pitchfork.com/feed/feed-news/rss'),
      feed('stereogum', 'Stereogum', 'stereogum.com', 'https://www.stereogum.com/feed/'),
      feed('consequence', 'Consequence', 'consequence.net', 'https://consequence.net/feed/'),
      feed('nme', 'NME', 'nme.com', 'https://www.nme.com/feed'),
      feed(
        'guardian-music',
        'The Guardian · Music',
        'theguardian.com',
        'https://www.theguardian.com/music/rss',
      ),
    ],
  },
  {
    id: 'sports',
    name: 'Sports',
    emoji: '⚽',
    hue: '#F97316',
    covers: 'Football · Formula 1 · Tennis · Basketball',
    sources: [
      feed('bbc-sport', 'BBC Sport', 'bbc.co.uk', 'https://feeds.bbci.co.uk/sport/rss.xml'),
      feed('espn', 'ESPN', 'espn.com', 'https://www.espn.com/espn/rss/news'),
      feed('formula1', 'Formula 1', 'formula1.com', 'https://www.formula1.com/en/latest/all.xml'),
      feed(
        'guardian-football',
        'The Guardian · Football',
        'theguardian.com',
        'https://www.theguardian.com/football/rss',
      ),
      feed(
        'bbc-tennis',
        'BBC Sport · Tennis',
        'bbc.co.uk',
        'https://feeds.bbci.co.uk/sport/tennis/rss.xml',
      ),
    ],
  },
  {
    id: 'food',
    name: 'Food & Cooking',
    shortName: 'Food',
    emoji: '🍳',
    hue: '#F59E0B',
    covers: 'Recipes · Techniques · Restaurants · Baking',
    sources: [
      feed(
        'smittenkitchen',
        'Smitten Kitchen',
        'smittenkitchen.com',
        'https://smittenkitchen.com/feed/',
      ),
      feed('bonappetit', 'Bon Appétit', 'bonappetit.com', 'https://www.bonappetit.com/feed/rss'),
      feed(
        'guardian-food',
        'The Guardian · Food',
        'theguardian.com',
        'https://www.theguardian.com/food/rss',
      ),
      youtube('weissman', 'Joshua Weissman', 'UChBEbMKI1eCcejTtmI32UEw'),
      youtube('kenji', 'J. Kenji López-Alt', 'UCqqJQ_cXSat0KIAVfIfKkVA'),
    ],
  },
  {
    id: 'health',
    name: 'Health & Fitness',
    shortName: 'Health',
    emoji: '🏃',
    hue: '#10B981',
    covers: 'Running · Sleep · Nutrition · Mental health',
    sources: [
      feed(
        'runnersworld',
        "Runner's World",
        'runnersworld.com',
        'https://www.runnersworld.com/rss/all.xml/',
      ),
      feed(
        'conversation-health',
        'The Conversation · Health',
        'theconversation.com',
        'https://theconversation.com/us/health/articles.atom',
      ),
      feed('npr-health', 'NPR · Health', 'npr.org', 'https://feeds.npr.org/1128/rss.xml'),
      feed(
        'guardian-wellbeing',
        'The Guardian · Wellbeing',
        'theguardian.com',
        'https://www.theguardian.com/lifeandstyle/health-and-wellbeing/rss',
      ),
      podcast(
        'huberman',
        'Huberman Lab',
        'hubermanlab.com',
        'https://feeds.megaphone.fm/hubermanlab',
      ),
    ],
  },
]

/** Sources for a custom keyword topic: news search and Hacker News, both as feeds. */
export function keywordSources(keyword: string): CatalogSource[] {
  const slug = keyword.trim().toLowerCase()
  const q = encodeURIComponent(keyword.trim())
  return [
    {
      id: `gnews:${slug}`,
      name: 'Google News search',
      site: 'news.google.com',
      feed: `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
      kind: 'search',
    },
    {
      id: `hn:${slug}`,
      name: 'Hacker News search',
      site: 'news.ycombinator.com',
      feed: `https://hnrss.org/newest?q=${q}`,
      kind: 'search',
    },
  ]
}
