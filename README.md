# Readar

Pick the topics you care about. Readar watches blogs, news sites, YouTube and podcasts for you, writes a short Claude summary of everything new, and lets you swipe through it: ← dismiss, → like, ↑ read later.

One React codebase for the Mac app, the iPhone app and the web, in three styles people choose from: Native Glass, Editorial Calm and Playful Deck.

> **Status: MVP in progress (Phase 0).** The deck, the three styles and onboarding work with sample cards. Real articles, sign-in and sync, and Claude summaries come next. [HANDOFF.md](HANDOFF.md) says where things stand; [PLAN.md](PLAN.md) holds the product plan and decisions.

## What works today

- Onboarding in three steps: pick a style, pick topics (15 starter topics or any keyword to watch), then choose sources per topic (81 suggested feeds you can switch off, plus your own links).
- One deck per topic: drag cards or use the keyboard, open the full summary, undo anything, and find cards again in Liked, Read later and Dismissed.
- Three styles, each in light and dark, switchable in Settings.
- The Mac app (Tauri 2) and the same app in a browser.

Not yet: real articles (cards are fictional samples), sign-in and sync (lists reset on reload), Claude summaries, the iPhone build.

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

The first launch opens onboarding. To start over in a browser, clear the site's local storage (`readar.theme` and `readar.setup`).

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

## Project structure

```
apps/client/          React app shared by Mac, iPhone and web (Vite)
  src/theme/          Theme tokens and the theme store
  src/deck/           Deck store, cards, gestures, keyboard, lists
  src/shell/          Layout and navigation per style, settings, toasts
  src/onboarding/     Setup flow (style, topics, sources) and its store
  src/data/           Topic catalog and sample cards
  src-tauri/          Tauri 2 shell for macOS and iOS
scripts/              Feed health check and UI checks
docs/brief.html       Source of the product brief page
PLAN.md               Product and build plan
HANDOFF.md            Current state and next steps
AGENTS.md             Conventions for contributors and coding agents
```

## Configuration

Copy `apps/client/.env.example` to `apps/client/.env.local` and fill in the Supabase project URL and publishable key. Env files are gitignored. Secret keys never go in the client, in git, or in chat. Recommended Supabase settings are in [PLAN.md §13](PLAN.md#13-setup-checklist).

## Claude

Readar never asks for a Claude.ai login: Anthropic doesn't allow third-party apps to use Claude subscriptions. Each person connects their own Claude Console API key, which stays on their device. Summaries use Claude Sonnet 5.5.
