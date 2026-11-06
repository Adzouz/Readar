# Readar

Pick the topics you care about. Readar watches blogs, news sites, YouTube and podcasts for you, writes a short Claude summary of everything new, and lets you swipe through it: ← dismiss, → like, ↑ read later.

One React codebase for the Mac app, the iPhone app and the web, in three styles people choose from: Native Glass, Editorial Calm and Playful Deck.

> **Status: MVP in progress.** Real articles, sync and email sign-in work. Claude summaries and the iPhone build come next. [PLAN.md](PLAN.md) holds the product plan, the decisions and what comes next.

## What works today

- Onboarding in three steps: pick a style, pick topics (15 starter topics or any keyword to watch), then choose sources per topic (81 suggested feeds you can switch off, plus your own links).
- One deck per topic: drag cards or use the keyboard, open the full summary, undo anything, and find cards again in Liked, Read later and Dismissed.
- Three styles, each in light and dark, switchable in Settings.
- Real articles: a fetch worker reads the feeds people follow (sites, YouTube, podcasts, Google News and Hacker News searches, links people add) and writes them to Supabase.
- Sync through Supabase: an anonymous account from the first launch, then email sign-in with a one-time code or a link that can open the Mac app. Topics, sources, style and lists follow you across devices, and the app keeps working offline from a local cache.
- The Mac app (Tauri 2) and the same app in a browser.

Not yet: Claude summaries (cards show the source's own excerpt), ranking (decks are newest first), the iPhone build. Known limitations are in [PLAN.md §11](PLAN.md#known-limitations).

## Requirements

- macOS with Node 24+ and pnpm 10
- Rust via [rustup](https://rustup.rs), for the Mac and iPhone apps
- Xcode with the iOS platform, for the iPhone app
- Google Chrome, for the UI checks

## Getting started

```sh
pnpm install
pnpm dev        # web app at http://localhost:1420
pnpm app        # Mac app (Tauri)
pnpm app:ios    # iPhone simulator (Tauri)
```

The first launch opens onboarding. To start over in a browser, clear the site's local storage (every `readar.*` key). Without Supabase settings, or with `?offline` in the dev URL, the app runs on sample cards.

To get real articles:

```sh
pnpm db:push --dry-run   # list pending database migrations
pnpm db:push --yes       # apply them to the Supabase project
pnpm worker              # fetch loop; pnpm worker:once for a single pass
```

## Keyboard

| Key                | Action            |
| ------------------ | ----------------- |
| ← or H             | Dismiss           |
| → or L             | Like              |
| ↑ or K             | Read later        |
| Space              | Full summary      |
| ↵ or O             | Open the original |
| S                  | Share the link    |
| ⌘Z, U or Backspace | Undo              |
| 1–9                | Switch topic      |
| ⌘,                 | Settings          |

## Scripts

| Command            | What it does                                                                  |
| ------------------ | ----------------------------------------------------------------------------- |
| `pnpm dev`         | Web app with hot reload on port 1420                                          |
| `pnpm app`         | Mac app in development                                                        |
| `pnpm app:ios`     | iPhone simulator in development                                               |
| `pnpm build`       | Web build into `apps/client/dist`                                             |
| `pnpm typecheck`   | TypeScript                                                                    |
| `pnpm lint`        | oxlint; warnings fail                                                         |
| `pnpm test`        | Vitest                                                                        |
| `pnpm format`      | Prettier                                                                      |
| `pnpm check:feeds` | Fetches every suggested feed in the catalog and reports the ones that fail    |
| `pnpm ui:check`    | With `pnpm dev` running: every screen, style and size fits the window         |
| `pnpm ui:shots`    | With `pnpm dev` running: screenshots of the main screens into `.screenshots/` |
| `pnpm db:push`     | Applies `supabase/migrations` to the project in `DATABASE_URL`                |
| `pnpm worker`      | Fetch worker loop (`pnpm worker:once` for one pass)                           |

## Project structure

```
apps/client/          React app shared by Mac, iPhone and web (Vite)
  src/theme/          Theme tokens and the theme store
  src/deck/           Deck store, cards, gestures, keyboard, lists
  src/shell/          Layout and navigation per style, settings, toasts
  src/onboarding/     Setup flow (style, topics, sources) and its store
  src/sync/           Supabase session, setup sync, decks and lists, swipe outbox
  src/data/           Sample cards
  src-tauri/          Tauri 2 shell for macOS and iOS
apps/worker/          Fetch worker: sources, feeds, dedupe, article text
packages/core/        Topic catalog, URL helpers, shared types
supabase/             Migrations, local config, sign-in email template
scripts/              Feed health check, database push, UI checks
docs/brief.html       Source of the product brief page
PLAN.md               Product and build plan, next steps, known limitations
AGENTS.md             Conventions for contributors and coding agents
```

## Configuration

Copy `apps/client/.env.example` to `apps/client/.env.local` and fill in the Supabase project URL and publishable key. Copy the root `.env.example` to `.env.local` and fill in `DATABASE_URL` (Supabase → Connect → Session pooler) for the worker and `pnpm db:push`; `YOUTUBE_API_KEY` is optional. Env files are gitignored. Secret keys never go in the client, in git, or in chat. Recommended Supabase settings are in [PLAN.md §13](PLAN.md#13-setup-checklist).

## Claude

Readar never asks for a Claude.ai login: Anthropic doesn't allow third-party apps to use Claude subscriptions. Each person connects their own Claude Console API key, which stays on their device. Summaries use Claude Sonnet 5.5.
