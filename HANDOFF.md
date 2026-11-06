# Handoff

Last session: 6 November 2026. Read this first, then [PLAN.md](PLAN.md) for the full plan and [AGENTS.md](AGENTS.md) for conventions.

To resume in a new session, open Claude Code in this folder and ask it to continue Readar from HANDOFF.md, step 1.

## TL;DR

- **Readar**: pick topics, Readar watches feeds, YouTube and podcasts, writes Claude summaries, and you triage cards like a deck (← dismiss, → like, ↑ read later). Mac, iPhone and web from one Tauri 2 + React codebase; Supabase backend.
- **Phase 0 is mostly done**: three styles in light and dark, the deck with gestures, keyboard and undo, lists, and onboarding (style, topics, sources). All of it runs on sample cards. The Mac app builds.
- **Next**: wire Supabase (the project exists and `apps/client/.env.local` is filled in), build the fetch worker so decks show real articles, then the Claude key and on-device summaries.
- **Blocked**: the iPhone build needs Xcode's iOS platform (`xcodebuild -downloadPlatform iOS`).

## Decisions made so far

Full table in PLAN.md §2–3. The ones that shape the next steps:

| Decision                                    | Why                                                                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Name **Readar** (was Sonar)                 | "Sonar" is crowded on the App Store and used by Perplexity and SonarQube. getreadar.com and readar.news were free on 6 Nov; register before launch.                                                                                  |
| **Tauri 2 + React**, Mac + iPhone + web     | One codebase; the owner knows the React stack from PRism. Capacitor is the fallback if Tauri iOS falls short.                                                                                                                        |
| **Supabase**                                | Postgres + pgvector, Auth, Realtime, Queues. Recommended settings: Data API on, auto-expose new tables off (grant explicitly in migrations), automatic RLS on.                                                                       |
| **Claude Sonnet 5.5** (`claude-sonnet-5-5`) | The owner's choice over Opus 5.5 and Haiku 5.5; don't change it without asking.                                                                                                                                                      |
| **Own Claude API key, on the device**       | Anthropic forbids Claude.ai login and subscription credentials in third-party apps. Keys stay in the keychain (browser storage on web); summaries are written on the device and stored per user. No shared summary cache in the MVP. |
| **Three themes, look and feel only**        | Native Glass (default), Editorial Calm, Playful Deck. Picked in onboarding, switchable in Settings. Same features and keyboard map everywhere.                                                                                       |
| **MVP trimmed**                             | No plans or billing, sharing sends the article's own link, English only. Plans, share pages, more languages and the store launch come with the public launch (Phase 3).                                                              |
| **No Reddit**                               | Reddit ends RSS on 13 Nov 2026 and closed new API requests on 31 Oct 2026.                                                                                                                                                           |
| **RSS first**                               | Free news APIs are delayed or non-commercial. Google News RSS search and Hacker News (hnrss) power keyword watches.                                                                                                                  |

## What exists

| Area         | Where                 | Notes                                                                                                                                                                                           |
| ------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client app   | `apps/client`         | React 19, Vite 8, TypeScript 7, Tailwind 4, Motion 14, zustand 5, lucide-react. Fonts bundled with Fontsource (Geist, Newsreader, Bricolage Grotesque).                                         |
| Themes       | `src/theme`           | Tokens in `themes.css` (3 styles × light/dark), `ThemeScope` + `useStyle()`, store persisted as `readar.theme`.                                                                                 |
| Deck         | `src/deck`            | `createDeckStore`: decide, undo, restore, markRead, select, `load(topics)`. Cards and action bars per style, `SwipeCard` with Motion drag, keyboard map in `useDeckKeys`, list views.           |
| Shell        | `src/shell`           | Layout per style (glass sidebar or phone strip, editorial masthead, playful bubbles), Settings dialog, toasts.                                                                                  |
| Onboarding   | `src/onboarding`      | Setup store persisted as `readar.setup`: step, topicIds, keywords, disabledSourceIds, userSources. Style, topic and source pickers. `connectDeckToSetup()` reloads the deck when topics change. |
| Catalog      | `src/data/catalog.ts` | 15 topics, 81 feeds (sites, YouTube channels, podcasts), all passing `pnpm check:feeds` on 6 Nov. `keywordSources()` builds Google News + Hacker News search feeds for keyword watches.         |
| Sample cards | `src/data/sample.ts`  | Fictional sources with example.com links, only for `ai`, `design`, `space` and a `kw-strapi` keyword watch. Other topics show "No articles yet".                                                |
| Tauri        | `src-tauri`           | Bundle id `io.github.adzouz.readar`, overlay title bar, opener plugin, drag-region permission, icons generated from `icon.svg`, Xcode project in `gen/apple`.                                   |
| Scripts      | `scripts/`            | `check-feeds.ts`, `ui/check-layout.mjs`, `ui/screenshots.mjs`.                                                                                                                                  |
| Docs         | root, `docs/`         | README, PLAN, AGENTS, this file; `docs/brief.html` is the source of the brief page.                                                                                                             |

Tests: 16 Vitest tests (deck store and setup store). Lint, typecheck, build and `pnpm ui:check` pass.

## Machine and accounts

- Installed during the session: Rust via rustup (stable 1.99 with iOS targets, rustfmt and clippy; the installer added cargo to the shell profile), and libimobiledevice through Homebrew (installed by `tauri ios init`).
- Already present: Node 26, pnpm 10.19, Xcode 27 (without the iOS platform), CocoaPods, Google Chrome.
- Supabase: project created by the owner; `apps/client/.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Confirm with the owner that the recommended settings were applied, including the email one-time code template (`{{ .Token }}`) and anonymous sign-ins.
- Not set up yet: Claude Console API key, YouTube Data API key, Apple Developer Program, domains, trademark search.

## Next steps, in order

### 1. Supabase foundation (Phase 1)

- Add `@supabase/supabase-js` and a client module that reads the env vars; the app must keep working when they're missing.
- Move the catalog into a shared package (`packages/core`) so the client, the worker and the database seed use one source.
- `packages/db`: schema for the tables in PLAN.md §8, migrations, RLS policies plus explicit grants (auto-expose is off), pgvector and pgmq extensions. Choose between Drizzle migrations and the Supabase CLI (`npx supabase`; not installed globally). Migrations need the database URL from the owner, kept in a gitignored env file.
- Auth: anonymous session on first launch, then email one-time code to keep the account (link the email, verify the code).
- Sync the setup (topics, sources) and the lists (`user_items`) to Supabase, keeping local storage as a cache. Today the lists reset on reload.

### 2. Fetch worker and real articles

- `apps/worker` (Node 26, TypeScript): schedule loop, conditional GET (ETag, Last-Modified), RSS/Atom parsing (pick a maintained parser), URL normalization and dedupe, Readability text extraction, writes to `items`.
- Source specifics: Google News RSS links need decoding to reach the publisher (keep the wrapper URL when decoding fails); YouTube channel feeds have had intermittent 404s, with the Data API as fallback; hnrss for Hacker News.
- Client: replace sample cards with real items per followed topic. Embeddings and the ranking function can follow the first real decks.

### 3. Claude key and on-device summaries (finishes Phase 0)

- Load the `claude-api` skill before writing API code: structured outputs, low effort, server-side refusal fallback, no sampling parameters, thinking can't be disabled on Sonnet 5.5.
- Key storage: a Tauri command backed by the OS keychain on Mac and iPhone (for example the `keyring` crate); browser storage with a clear warning on web. Decide the call path: the SDK in the webview, or a Rust-side request so the key never reaches JavaScript.
- Before keys land: set a strict CSP in `tauri.conf.json` (it is `null` today) and allow the inline theme script in `index.html` by hash.
- A skippable "Connect Claude" onboarding step plus a Settings entry; validate the key with one cheap call.
- Summary spike on ~50 real articles: quality, tokens, cost. Summaries saved per user, written for the next ~5 cards while reading.

### 4. iPhone

- Owner: `xcodebuild -downloadPlatform iOS` (several GB), then `pnpm app:ios`.
- Check gestures, safe areas, haptics, the share sheet and an in-app Safari view (plugins or small Swift plugins), and the keychain.

### 5. CI

- GitHub Actions: install, lint, typecheck, test, build; a weekly `pnpm check:feeds`.

## Known issues and gotchas

- iOS build stops with "iOS platform not installed".
- In the Mac app, Share copies the link; browsers use Web Share. The native share sheet comes with the iPhone work.
- Lists live in memory and reset on reload until sync lands.
- Layout: the page must never scroll. A missing `relative` on a scroll area let `sr-only` labels stretch the page and produced a double scrollbar in the Mac app (fixed). `pnpm ui:check` catches it.
- oxlint's `react/hooks` rule flags `useStore.getState()` inside component bodies; use selectors there.
- The owner's RTK shell hook filters some command output; see the tooling notes in AGENTS.md.
- Port 1420 is strict and the owner often runs the dev server; reuse it.
- Claude Code memory is keyed to the folder path `…/apps/sonar`; renaming the folder starts a fresh memory.

## Open questions for the owner

- Claude call path on device (SDK in the webview vs a Rust-side call).
- Embedding model, worker host, web host.
- Speech-to-text provider for podcasts, or transcripts only at first.
- Supabase region, and how long to keep extracted article text.

## Links

- Brief with the clickable deck prototype: https://claude.ai/artifact/NuKHhwoXB6bxKiPjfpKQNJ (private; source in `docs/brief.html`; update it by publishing to the same artifact URL).
- Research notes and sources: PLAN.md §14.
