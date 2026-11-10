# Readar — product and build plan

> Status: §11 steps 1–2 done (6 Nov 2026, PR #1): real articles, Supabase sync, email sign-in. Next: [§11 Next up](#next-up) step 3 (sync follow-ups), then step 4 (Claude summaries). Known gaps: [§11 Known limitations](#known-limitations).
> Repo: `git@github.com:Adzouz/Readar.git`. The local folder is still named `sonar/`, the working title.
> Visual brief with a clickable deck prototype: https://claude.ai/artifact/NuKHhwoXB6bxKiPjfpKQNJ (source: [docs/brief.html](docs/brief.html)).

## 1. Product

Readar watches the topics you care about (blogs, news sites, YouTube, podcasts, any web page) and turns everything new into short AI summaries you triage like a deck of cards.

- Each topic is its own lane, so following many topics never turns into one noisy feed.
- Cards: ← dismiss (goes to Dismissed, restorable), → like (Liked), ↑ read later (Read later). A summarizes with Claude (on demand), Space shows or hides the AI summary, R reads it aloud, ↵ opens the original, S shares, ⌘Z undoes.
- Every topic comes with suggested sources. People add their own (URL, YouTube channel, keyword, OPML) and switch any source on or off.
- Lists, topics, sources and settings sync across Mac, iPhone and web.

## 2. MVP scope (updated 6 Nov 2026)

The first MVP is deliberately small:

- Mac, iPhone and web from one Tauri 2 + React codebase.
- No plans and no billing. Every user connects their own Claude API key.
- Sharing sends the article's own link (share sheet or copy). No share pages, no domain.
- English only, for the interface and the summaries.
- Email sign-in with a one-time code, with an anonymous session until the user signs in.

After the MVP, the public launch adds: Free / Pro / Pro + own key plans, Readar share pages on readar.news, French, Spanish, German and Portuguese (Brazil), Sign in with Apple and Google, and the store launch.

## 3. Decisions

| Area              | MVP                                                                                                                        | After the MVP                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Name              | Readar (read + radar)                                                                                                      | Register getreadar.com + readar.news; trademark search |
| Platforms         | Mac, iPhone, web                                                                                                           | Android                                                |
| App shell         | Tauri 2 + React                                                                                                            |                                                        |
| Backend           | Supabase: Postgres + pgvector, Auth, Realtime, Queues                                                                      | Vault if keys ever move server-side                    |
| Summaries         | Claude Sonnet 5.5 (`claude-sonnet-5-5`), written on the user's device with their own API key                               | Readar-paid summaries for Free and Pro                 |
| Claude connection | Claude Console API key in the device keychain (browser storage on web)                                                     | Pro + own key plan                                     |
| Themes            | Native Glass (default), Editorial Calm, Playful Deck; picked in onboarding; look and feel only; light + dark               |                                                        |
| Sharing           | The article's own link                                                                                                     | Readar share pages                                     |
| Languages         | English                                                                                                                    | fr, es, de, pt-BR; summaries in the reader's language  |
| Sign-in           | Email one-time code; anonymous first                                                                                       | Sign in with Apple, Google                             |
| Sources           | Feeds, YouTube, keyword watches, Hacker News, sites without a feed, podcasts                                               | Newsletters, Bluesky, Mastodon                         |
| Reading           | Default browser (Mac, web), Safari view (iPhone)                                                                           |                                                        |
| Not possible      | Reddit: RSS ends 2026-11-13, new API requests closed 2026-10-31                                                            |                                                        |
| Not allowed       | Claude.ai login, Free/Pro/Max/Ultra plan credentials, or routing summaries through a user's Claude Code (Anthropic policy) |                                                        |

### Why

- **Readar, not Sonar:** "Sonar" is crowded on the App Store and used by Perplexity's API and SonarQube. No App Store app uses "Readar"; getreadar.com and readar.news were free on 6 Nov (readar.app and readar.com are taken).
- **Tauri 2 + React:** one codebase for three targets, with the React toolbox the owner already uses in PRism. Capacitor around the same UI is the fallback if Tauri's iOS support falls short.
- **Supabase:** Postgres with pgvector for ranking, plus Auth, Realtime and Queues in one place. Project settings: Data API on, new tables not exposed automatically (migrations grant access explicitly), automatic RLS on.
- **Own Claude API key, kept on the device:** Anthropic forbids third-party apps from using Claude.ai logins or subscription credentials, and one person's key must never serve someone else. Keeping the key on the device also avoids storing it on a server.
- **Claude Sonnet 5.5:** the owner's pick over Opus 5.5 (better nuance, twice the price) and Haiku 5.5 (far cheaper, less nuance). Don't change it without asking.
- **Three themes, look and feel only:** the experience should suit each person's personality, without three different flows to build and test.
- **RSS first:** free news APIs arrive late or forbid commercial use, and Reddit closed its feeds and API.

## 4. Experience

### Onboarding

1. Welcome.
2. Pick a style: the three themes side by side, each with a sample card. Skipping picks Native Glass.
3. Pick topics: big tiles with icons (15 starter categories, 4–6 subtopics each) plus "type any keyword".
4. Fine-tune sources: suggested sources per topic as toggles; add your own.
5. Connect Claude: paste a Claude Console API key, with a link to Console and a one-call check. Skippable; cards then show the source's own excerpt instead of an AI summary.
6. First deck. Email sign-in is offered after the first deck, to sync across devices; the user runs on an anonymous Supabase session until then.

### Deck

- Card: content type, source, age, length, relevance (1–3 bars), title, the source's own excerpt (always shown), the AI summary on request (TL;DR and three key points in a panel labeled "Summary by Claude", Space), "why for you", "also covered by N sources".
- Keyboard (Mac, web): ← → ↑ (or h, l, k), A, Space, R, ↵/O, S, ⌘Z/U, 1–9 to switch topic, ⌘, for settings; ⌘K command bar and ? shortcut sheet later.
- iPhone: swipe left, right or up, tap to expand, haptics, share sheet, Safari view.
- Buttons under the card for people who don't swipe. Undo is unlimited.
- Each topic ends with an "All caught up" state.

### Themes (look and feel only)

- A theme is a token set (colors for light and dark, fonts, radius, shadows) plus three variant components: Card, topic navigation (glass sidebar / edition header / story bubbles) and ActionBar.
- Fonts: Glass uses the system font; Editorial uses Newsreader + Geist; Playful uses Bricolage Grotesque + Geist. All bundled (no network).
- Routes, features and the keyboard map are identical across themes.

### Sharing

- The share sheet (Mac, iPhone) or Web Share (web) sends the article's own URL; copy-link fallback everywhere.

## 5. Content pipeline

| Source               | How                                                                                                                              | Notes                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Feeds (RSS/Atom)     | Conditional GET (ETag / Last-Modified); feed autodiscovery from any URL                                                          | Backbone of the product                                                                                                                      |
| YouTube              | Channel feed (`/feeds/videos.xml?channel_id=`, latest 15 uploads); Data API v3 as fallback and for keyword search                | Default quota 10,000 units/day and `search.list` costs 100: share keyword searches across users. Feeds had intermittent 404s since Dec 2025. |
| Keyword watches      | Google News RSS search (decode redirect links, keep the wrapper URL if decoding fails), Hacker News Algolia API, YouTube search  |                                                                                                                                              |
| Dev communities      | Hacker News, Lobsters, GitHub release feeds                                                                                      |                                                                                                                                              |
| Sites without a feed | Page watcher: fetch the page, extract candidate article links, diff against links already seen. RSSHub routes for popular sites. | robots.txt, rate limits, identifiable user agent                                                                                             |
| Podcasts             | Episode feeds; `podcast:transcript` when the show publishes one, otherwise speech-to-text                                        | Provider to pick in Phase 2                                                                                                                  |

Free news APIs (NewsAPI, GNews, NewsData) are skipped: free tiers arrive 12–24 h late or forbid commercial use.

Pipeline stages (worker):

1. **Schedule.** Every few minutes, enqueue sources whose `next_fetch_at` has passed (Supabase Queues). Each source gets an adaptive interval.
2. **Fetch and parse.** Normalize URLs (strip tracking parameters), dedupe on the canonical URL hash.
3. **Enrich.** Extract article text (Readability) when the feed only has an excerpt, detect language, embed title + excerpt, cluster near-duplicates. Extracted text is kept only long enough to summarize (retention to set).
4. **Rank on read.** A Postgres function `deck(topic_id, limit)` returns undecided items ranked by similarity to the topic vector, adjusted by the user's taste vector, source affinity and freshness (HNSW index on embeddings).

Summaries are written by the client, not the worker (see §6).

## 6. AI (MVP)

- Each user's own Claude Console API key. Mac and iPhone: stored in the OS keychain through a small Tauri command. Web: browser storage, with a clear warning that it is weaker.
- Summaries are on demand (decided 6 Nov), so the user only pays for cards they care about: a Summarize button on every card and in the lists, shortcut `A` in every style. Settings has a "Summarize ahead" switch, off by default, that summarizes the next ~5 cards automatically. Input: title + extracted text from the worker, or the feed excerpt; text over 20,000 characters is cut.
- Call path (decided 6 Nov): the official TypeScript SDK in the webview on every platform, one code path. On Mac and iPhone the key is read from the keychain only when a call is made; a strict CSP limits connections to Supabase and `api.anthropic.com`. A Rust-side call was rejected: Rust has no official SDK, and it would mean two code paths.
- "Connect Claude" is the last, skippable onboarding step (after sources), plus a Settings entry.
- Prompt and output schema live in `packages/core/src/summary.ts`, shared by the client and `pnpm spike:summaries` (dev only, reads `ANTHROPIC_API_KEY` from the root `.env`, writes its report to the OS temp directory).
- "No credit" arrives as HTTP 400 `invalid_request_error`, not 402: the client must tell it apart from other 400s to show the right fix.
- Output: structured JSON (`output_config.format`, or `messages.parse` with zod): `tldr` (≤ 30 words), `points` (3), `contentType`, `readingMinutes`. "Why for you" comes from matched topics and taste, without the model.
- Summaries are saved to Supabase as private rows of that user and sync to their other devices. No shared cache in the MVP: every summary is paid by the key owner and only serves them (Anthropic forbids using one user's credentials for others).
- Effort starts at `low`; server-side refusal fallback on (`fallbacks: "default"`). API version 2026-10-21 rejects sampling parameters, and Sonnet 5.5 rejects `thinking: disabled`. Check the current SDK docs when implementing.
- Cost to the user: about $9 per 1,000 summaries (to confirm with the spike); 20 summaries a day is about $5 a month.
- No key: cards show the feed's own excerpt and a "Connect Claude" prompt. Key errors (invalid, no credit): summaries pause, excerpts show, Settings explains the fix.

## 7. Architecture (MVP)

```
Mac / iPhone / web apps (Tauri 2 + React)
  │ auth, topics, swipes, lists, summaries         ▲ live updates (Realtime)
  ├──► Claude Sonnet 5.5 (user's own API key, called from the device)
  ▼                                                │
Supabase: Auth · Postgres + pgvector · Realtime · Queues
  ▲                          │ jobs
  │ items, text, vectors     ▼
Fetch & enrich worker (Node, scheduled) ──► feeds, YouTube, news search, HN, pages, podcasts
```

Repo layout:

```
apps/
  client/          React app (Vite) for Mac, iPhone and web
    src/theme/     Theme tokens (3 styles × light/dark) and the theme store
    src/deck/      Deck state, cards, gestures, keyboard, lists
    src-tauri/     Tauri 2 shell (macOS + iOS)
  worker/          Node worker: schedule, fetch, enrich (Phase 1)
packages/
  core/            Domain types, zod schemas, ranking helpers (Phase 1)
  db/              Drizzle schema, migrations, RLS, SQL functions (Phase 1)
supabase/          Local config and seed data (Phase 1)
```

Tooling, same as PRism: pnpm workspaces, TypeScript, React 19, Vite, Tailwind 4, zustand, Motion for gestures, lucide icons, oxlint, prettier, vitest. TanStack Router + Query, zod and shadcn/ui come in with real data in Phase 1.

## 8. Data model (MVP, first cut)

| Table                         | Purpose                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                    | User settings: theme, light/dark, onboarding state                                                                                        |
| `categories`                  | Starter categories: slug, emoji, color, name                                                                                              |
| `topics`                      | Catalog topics and users' custom keyword topics: keywords, description, embedding                                                         |
| `sources`                     | Feeds, channels, pages, podcasts: type, URLs, ETag/Last-Modified, `next_fetch_at`, health                                                 |
| `topic_sources`               | Default sources per catalog topic                                                                                                         |
| `user_topics`, `user_sources` | What each user follows and which sources are switched on                                                                                  |
| `items`                       | Fetched entries: canonical URL hash, title, author, dates, image, excerpt, extracted text (temporary), type, language, embedding, cluster |
| `summaries`                   | One row per user × item × prompt version (private to the user)                                                                            |
| `user_items`                  | Swipe state per user: new, liked, later, dismissed, read; timestamps                                                                      |
| `user_topic_taste`            | Per user × topic taste vector, updated on each swipe                                                                                      |

Row Level Security on every user-owned table (`user_id = auth.uid()`).

As built (6 Nov): no `categories` table yet (the catalog has no category level) and no `user_topic_taste` (needs embeddings). Extra tables: `item_sources` (the same article from several sources) and `item_aliases` (Google News wrapper links). Clients never read shared tables directly. They call the security-definer functions `deck`, `list_items` and `my_source_health` (fetch status of the user's own sources, shown on the sources screen and as a notice in the topic view), so the links a user adds stay private. `summary_input` returns an item's text for the user's own summaries, only for items in their decks or lists. The worker writes a one-row `worker_heartbeat`; `worker_active` tells the app whether a worker beat in the last 3 minutes, so a source not fetched yet shows "Syncing…" only while one runs, and "Not fetched yet" otherwise. pgmq is not used: the worker claims due sources with `for update skip locked`, which is enough for one worker.

## 9. Platforms and distribution (MVP)

- Tauri 2 targets macOS and iOS; the same React client builds as the web app. Bundle id `io.github.adzouz.readar` (same pattern as PRism).
- Glass effects are CSS (backdrop blur inside the window), not macOS private APIs, so the Mac App Store stays possible later.
- Sign-in with a one-time email code needs no OAuth redirect or deep link, which keeps the iPhone app simple.
- MVP distribution: local builds and TestFlight. Store submissions come with the public launch.
- Risk: Tauri's iOS support is younger than Expo's or Capacitor's. The Phase 0 spike covers keychain, share sheet, Safari view and swipe performance. Fallback: wrap the same React client with Capacitor for iOS.

## 10. Trust and publishers (from the MVP)

- Short summaries, source shown prominently, always link out.
- Honor robots.txt and cache headers, identifiable crawler user agent with a contact page, opt-out on request, no paywall bypass.
- Extracted article text kept only as long as needed to summarize.

## 11. Roadmap

### Next up

In order, for the next sessions:

1. **Supabase foundation (done 6 Nov; migration applied).** `packages/core` holds the catalog, URL helpers and shared types. Schema, RLS, grants and client functions: `supabase/migrations/` (Supabase CLI, plain SQL). The client (`apps/client/src/sync`) starts an anonymous session, syncs the setup (`get_setup` / `save_setup`), loads decks and lists (`deck`, `list_items`), queues swipes in an outbox (`user_items`), and offers email-code sign-in in Settings. Checked end to end in the browser: anonymous session, setup saved, real decks, a like saved and reloaded from the server. Left: email sign-in on two devices.
2. **Fetch worker and real articles (done 6 Nov, runs locally).** `apps/worker` runs locally (`pnpm worker`, or `pnpm worker:once`). It syncs catalog, keyword and link sources, claims due sources, uses conditional GET, parses with feedsmith, decodes Google News links, falls back to the YouTube Data API when `YOUTUBE_API_KEY` is set, dedupes on the canonical URL hash, and extracts text with Readability while honoring robots.txt. First pass: 160 items from 13 sources in 21 s. Left: embeddings and ranking (pick the embedding model, §12) and a host (§12).
3. **Sync follow-ups (before summaries).** From the PR #1 re-review, both small, one PR (branch `fix/sync-follow-ups`):
   - Swipe race in `apps/client/src/sync/content.ts` (`applyPending` call in `loadContent`): only swipes still waiting to be sent are applied over the server lists, so a swipe whose send finishes while a reload is in flight can reappear until the next reload. Keep a log of the decisions made since the load started (sent or not) and apply that; extend the `applyPending` test.
   - Silent fallback in `apps/client/src/sync/account.ts` (`SIGNED_OUT` handler): when Supabase drops a signed-in email session, the app moves to a new anonymous session without saying so. Remember that the session had an email and show a toast ("Signed out. Sign in again to keep syncing."), with a test.
4. **Claude key and on-device summaries (in progress).** Done: strict CSP (Tauri), the key in the keychain on Mac and iPhone (`src-tauri/src/secrets.rs`) or browser storage with a warning on web, the call path (SDK in the webview, §6), a skippable "Connect Claude" step plus a Settings entry that check the key with the free models list call, and summaries on demand (`apps/client/src/claude`): a Summarize button next to "Open link" and on list rows, the `A` key, "Summarize ahead" (top card + next 5, off by default), private rows in `summaries` loaded with the cards, key or credit errors that pause summaries, and, once a card has a summary, "Read AI summary" (Space) and "Listen to AI summary" (`R`; the system voices read the title, Claude's summary and key points, Web Speech API, on the device, free). The card always keeps the source's excerpt; Claude's words only appear in their own labeled panel, and sample cards carry no made-up summary. Left: run it with a funded key, then the summary spike on ~50 real articles (quality, tokens, cost).
5. **iPhone.** Install Xcode's iOS platform (`xcodebuild -downloadPlatform iOS`), run `pnpm app:ios`, then check gestures, safe areas, haptics, the share sheet, an in-app Safari view and the keychain.
6. **Source health (done 9 Nov).** The sources screen shows what each source brought, or why it brings nothing (no feed found, blocked, rate limited, site down); the topic view warns when sources aren't bringing articles, and each topic header opens its sources. Sources not fetched yet say "Syncing…" only while a worker runs (`worker_heartbeat`, cleared when it exits).
7. **CI.** GitHub Actions for lint, typecheck, test and build, plus a weekly `pnpm check:feeds`.

### Known limitations

- Without Supabase settings, the app falls back to the fictional sample cards (AI, Design, Space, "Strapi").
- Cards without a Claude summary show only the source's excerpt (no key points), signal fixed at 2, no article images.
- Decks are newest first. Ranking waits for embeddings.
- No Realtime yet: other devices' changes appear on focus (after 2 min) or on restart.
- Email sign-in link: `<Site URL>/auth` offers "Open in the Readar app" (`readar://`, Tauri deep-link plugin) or the browser. The scheme only registers for the built, installed Mac app (not `pnpm app`), and Site URL is `http://localhost:1420` until the web app is hosted. iPhone gets universal links with the domain.
- Links people add aren't limited yet: the worker fetches any host (including private network addresses, also after redirects) and `save_setup` has no cap on topics or links. Fix before hosting the web app or the worker.
- A setup save that finishes after a newer local change marks it saved; quitting within 800 ms can lose that change on the next launch. Fix with a change counter.
- Signing in to an account that already has a setup adopts that account; the anonymous session's lists stay behind.
- In the Mac app, Share copies the link; browsers use Web Share. The native share sheet comes with the iPhone work.
- Source health counts every article a source ever brought, so "N articles" only grows and "No recent articles found" means none ever. Count a recent window instead.
- The web build has no CSP yet (the Tauri apps do): send the same policy as HTTP headers when the web app is hosted. Article images will need an `img-src` entry when they land.
- The iOS build stops with "iOS platform not installed" until Xcode's iOS platform is downloaded.

### Phase 0 — Foundations (now)

- [x] Monorepo; client app with the three themes (light + dark) and a sample deck: gestures, keys, buttons, undo, lists, style picker, settings.
- [x] Onboarding steps for style, topics (15-topic catalog + keyword watches) and sources (toggles, own links), saved on the device. Pulled forward from Phase 1.
- [x] Catalog health check (`pnpm check:feeds`) and layout check (`pnpm ui:check`).
- [x] Tauri: Mac app builds; web build.
- [ ] Tauri: iOS simulator (blocked until the Xcode iOS platform is installed).
- [ ] Spikes: Claude key in the keychain (Mac + iPhone); first summaries from the device on ~50 real articles (quality, tokens, cost); share sheet and Safari view on iPhone; swipe performance on a device.
- [ ] CI for lint, types and tests.
- Exit: the themed deck runs on Mac, the iPhone simulator and web; one real summary round trip with your key.

### Phase 1 — Core loop on Mac and web

- Supabase schema + RLS; anonymous session + email code sign-in; sync of setup and lists.
- Onboarding: add the "Connect Claude" step (style, topics and sources already exist).
- Worker: feeds, YouTube, keyword watches, Hacker News; dedupe; text extraction; embeddings; ranking function.
- Real decks, summaries on device with prefetch, synced lists, share link.
- Exit: daily use for a week.

### Phase 2 — iPhone and the rest of the MVP

- iPhone app at parity: gestures, haptics, share sheet, Safari view, keychain.
- Page watcher for sites without a feed; podcasts with transcripts.
- Exit: MVP complete on Mac, iPhone and web.

### Phase 3 — Public launch

- Free, Pro and Pro + own key (RevenueCat: App Store + Stripe).
- Readar share pages on readar.news; domains registered; trademark search.
- Interface in French, Spanish, German, Portuguese (Brazil); summaries in the reader's language.
- Sign in with Apple and Google; in-app account deletion; data export; terms, privacy and publisher policies.
- Mac App Store and App Store; landing page on getreadar.com; analytics and crash reporting.

### After launch

Android, a newsletter inbox, Bluesky and Mastodon, a morning briefing notification, a Mac menu-bar companion, widgets.

## 12. Open items

- ~~Claude call path on device~~: decided, SDK in the webview (§6).
- Embedding model: small open model in the worker or a hosted API.
- Hosts for the worker and the web app.
- Speech-to-text provider for podcasts (or transcripts-only at first).
- Supabase region; retention period for extracted text.

## 13. Setup checklist

Done on 6 Nov: Node 26, pnpm 10, Xcode 27, CocoaPods, Rust toolchain with iOS targets (rustup, plus rustfmt and clippy), libimobiledevice (installed by `tauri ios init`). Monorepo scaffolded; the Mac app builds (`pnpm app`), the web app runs (`pnpm dev`). Onboarding (style, topics, sources) works locally with a 15-topic catalog of 81 suggested feeds, all passing `pnpm check:feeds`; setup is saved on the device until Supabase sync lands.

Still missing on this Mac: the iOS platform for Xcode 27, needed for `pnpm app:ios` (Xcode → Settings → Components, or `xcodebuild -downloadPlatform iOS`; several GB).

Owner:

- Supabase project (in progress). Settings:
  - Region close to you (EU if you're in Europe).
  - Authentication → Sign In / Providers → Email: on. Custom SMTP (Resend) is required to edit email templates; paste `supabase/templates/sign-in.html` into "Magic link" and "Confirm signup". Site URL: `http://localhost:1420` until the web app is hosted.
  - Authentication → enable anonymous sign-ins.
  - Keys go in local env files, never in chat or git: `apps/client/.env.local` gets `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; the repo root `.env.local` gets `DATABASE_URL` (worker and `pnpm db:push`) and optionally `YOUTUBE_API_KEY`.
  - pgvector is enabled by our migrations (pgmq isn't used, see §8).
- Claude Console API key, for your own use and the Phase 0 summary check.
- Google Cloud project with a YouTube Data API key (Phase 1).
- Apple Developer Program for TestFlight; a free Apple ID can run builds on your own iPhone for 7 days at a time.
- Renaming this folder from `sonar/` changes the path Claude Code uses for this project's memory.

## 14. Research notes (6 Nov 2026)

- Apple Design Awards 2026: https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/
- Liquid Glass changes in macOS 27: https://www.cultofmac.com/news/liquid-glass-changes-ios-27-macos-27
- Reddit ends RSS and public API access: https://www.techrepublic.com/article/news-reddit-rss-public-api-shutdown/
- Anthropic, credential use in third-party apps: https://code.claude.com/docs/en/legal-and-compliance
- Google News RSS in 2026 (link decoding): https://www.codewords.ai/blog/google-news-rss
- YouTube channel feeds: https://www.wprssaggregator.com/youtube-rss-feed/
- News API free tiers (vendor post): https://newsdata.io/blog/news-api-comparison
- Kagi News feed lists (CC BY-NC, reference only): https://github.com/kagisearch/kite-public
- Folo, AGPL AI feed reader: https://github.com/RSSNext/Folo
- Tauri 2 mobile field notes: https://jlw-newsletter.pages.dev/jlw-2026-01-26-tauri.html
