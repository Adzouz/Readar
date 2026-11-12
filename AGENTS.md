# AGENTS.md

Guide for coding agents and contributors working on Readar.

**Start here:** [PLAN.md](PLAN.md) has the decisions and why (§3), what comes next in order and the known limitations (§11). Read it before changing behavior.

## Layout

| Path                         | Role                                                                       |
| ---------------------------- | -------------------------------------------------------------------------- |
| `apps/client`                | React app (Vite) shared by the Mac app, the iPhone app and the web app     |
| `apps/client/src/theme`      | Theme tokens (`themes.css`), theme store, `ThemeScope`, light/dark mode    |
| `apps/client/src/deck`       | Deck store (zustand), cards per theme, swipe gestures, keyboard, lists     |
| `apps/client/src/shell`      | App layout per theme, navigation, settings, toasts                         |
| `apps/client/src/onboarding` | Setup flow (style, topics, sources, Claude), setup store, deck wiring      |
| `apps/client/src/data`       | Sample cards (used when Supabase isn't configured)                         |
| `apps/client/src/sync`       | Supabase session, setup sync, decks and lists, swipe outbox                |
| `apps/client/src/claude`     | Claude key (keychain or browser), key check, summaries on demand and ahead |
| `apps/worker`                | Fetch worker: source sync, feeds, dedupe, text extraction (Node 26)        |
| `packages/core`              | Topic catalog, URL helpers, shared types (client, worker, scripts)         |
| `supabase/migrations`        | Schema, RLS, grants, client functions (plain SQL, Supabase CLI)            |
| `apps/client/src-tauri`      | Tauri 2 shell for macOS and iOS                                            |
| `scripts/check-feeds.ts`     | Health check for every catalog feed (`pnpm check:feeds`)                   |
| `scripts/db-push.ts`         | `pnpm db:push`: applies migrations with DATABASE_URL, never printed        |
| `scripts/ui`                 | Layout check and screenshots against the dev server (Playwright, Chrome)   |
| `docs/brief.html`            | Source of the product brief page (published as a claude.ai artifact)       |

## Commands

```sh
pnpm install
pnpm dev          # web build in the browser, http://localhost:1420
pnpm app          # Mac app (Tauri dev)
pnpm app:ios      # iPhone simulator (Tauri iOS dev)
pnpm typecheck
pnpm lint         # oxlint, warnings fail
pnpm test         # vitest
pnpm format       # prettier
pnpm check:feeds  # fetch every catalog feed; run after editing packages/core/src/catalog.ts
pnpm ui:check     # with pnpm dev running: no screen overflows the window
pnpm ui:shots     # with pnpm dev running: screenshots into .screenshots/
pnpm db:push      # apply supabase/migrations (DATABASE_URL in root .env.local or .env)
pnpm worker       # fetch loop (pnpm worker:once for a single pass); in production GitHub Actions
                  # runs worker:once every 15 minutes (.github/workflows/fetch.yml)
```

Rust comes from rustup (`~/.cargo/bin`); open a new shell after installing it, or run `. "$HOME/.cargo/env"`.

## Before handing back UI work

1. `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
2. With the dev server running: `pnpm ui:check`, then look at the `pnpm ui:shots` images (all three styles, light and dark, phone width).

Port 1420 is strict, and the owner often has `pnpm dev` or `pnpm app` running already. Reuse that server instead of stopping it.

## Conventions

- TypeScript strict, no `any`. Prettier: no semicolons, single quotes, width 100.
- Styling: Tailwind 4 utilities mapped to theme tokens (`bg-surface`, `text-ink`, `border-line`, `rounded-card`, `font-display`, `shadow-card`). Never hard-code theme colors in components: add a token to `themes.css`, in all six style × mode blocks, and map it in `styles.css`.
- Themes change look and feel only. Features, routes and the keyboard map are identical in every style; structural differences live in variant components picked with `useStyle()`.
- `useStyle()` reads the closest `ThemeScope`, so previews can render a different theme than the app. Use it instead of reading the theme store in components.
- zustand selectors must return stable references (no new arrays or objects); derive in the component body instead. Don't call `useSomething.getState()` in a component body (oxlint `react/hooks` flags it); use selectors there and `getState()` only in event handlers or outside React.
- Layout: the page itself never scrolls (`html, body { overflow: hidden }`). Every scroll area must be `relative` so absolutely positioned children (like `sr-only` labels) stay inside it; otherwise the Mac app shows a double scrollbar.
- Persisted client state: `readar.theme` (style, mode), `readar.setup` (onboarding step, topics, keyword watches, disabled sources, user links), `readar.sync` (setup changes not yet saved), `readar.deck` (cached cards and lists), `readar.outbox` (swipes not yet saved), `readar.auth` (Supabase session), `readar.claude` (web only: the user's Claude key; Mac and iPhone keep it in the keychain), `readar.summaries` (the "Summarize ahead" switch). `index.html` reads `readar.theme` before first paint, so keep its shape.
- Database: change the schema only through a new migration file. Shared tables get no client grants; expose shared content through security-definer functions with `set search_path = ''`. Update `apps/client/src/lib/database.ts` to match.
- Respect `prefers-reduced-motion`: gestures still work, animations are skipped.
- CSP (`src-tauri/tauri.conf.json`): `csp` is strict for builds, `devCsp` allows Vite's inline scripts and styles. Editing the theme script in `index.html` changes its hash: update `script-src` (`src/lib/csp.test.ts` fails until you do). A new remote origin (images, APIs) needs a `connect-src` or `img-src` entry.
- Glass effects are CSS only (no macOS private APIs), to keep the Mac App Store possible.

## Claude

- MVP rule: every user brings their own Claude Console API key. It stays on the device (keychain on Mac and iPhone, browser storage on web) and summaries are written from the device. Do not add server-side Claude calls or a shared summary cache.
- Never offer Claude.ai login or use Claude subscription credentials: Anthropic forbids it for third-party apps.
- Model: `claude-sonnet-5-5`, the owner's choice; don't change it without asking. Use the official TypeScript SDK and check current docs before writing API code (sampling parameters and `thinking: disabled` are rejected).

## Secrets

- Env files are gitignored; only `*.env.example` is committed. `apps/client/.env.local` holds the Supabase URL and publishable key. The repo root `.env.local` (or `.env`) holds `DATABASE_URL` and an optional `YOUTUBE_API_KEY` for the worker and `pnpm db:push`.
- Never paste or log the Supabase secret key, the database password or a Claude API key.

## Tooling notes

- PR review loop (project skills in `.claude/skills/`): `readar-pr-review` reviews a PR against these rules, `readar-address-comments` fixes the threads you pick and hands commit and push back to you, `readar-pr-re-review` checks the fixes and the new commits. Outside a "deliver" request (see below), none of them posts or pushes without asking.

- The owner's shell has an RTK hook that rewrites some commands (`curl`, `grep`, `cat`, `ls`) and filters their output. Use `rtk proxy <command>` for raw output. Don't pipe `curl` into `sh`: download to a file first. If `pnpm lint` prints "Linter process terminated abnormally", run `rtk proxy ./node_modules/.bin/oxlint --deny-warnings .` to see the real result.
- Claude Code memory for this project is keyed to the folder path (`…/apps/sonar`); renaming the folder starts a fresh memory.

## Delivering a feature or a fix

The agent owns the codebase. When the owner says **"deliver"** a feature or a bug fix, run the whole loop without asking at each step:

1. Run the gates from "Before handing back UI work", commit (conventional subject), push the branch.
2. Open the PR on `Adzouz/Readar` with a title and a description (what, why, how to test, pending migrations, known limits).
3. Start a fresh review by a neutral agent (a new subagent with no context from the implementation, following `readar-pr-review`). Post its findings on the PR as one review: inline comments for the issues and fixes to make, and a summary with a **GO / NO GO** status.
4. Fix the findings (tests for each bug), run the gates, push, reply under the fixed threads with the commit.
5. Run a new neutral re-review (`readar-pr-re-review`) and post it. Repeat 4–5 until the status is **GO**.

Stay pragmatic: only blocking findings and nits marked _Address before merge_ (bugs that cost the user money or data, broken flows, rule violations) need another round. A **GO WITH NITS** whose remaining nits are minor or "follow-up is fine" counts as **GO**: list them in the final review as follow-ups (or in PLAN.md §11 when they matter later) instead of looping on them. A docs-only fix doesn't need a new review round.

The other rules still hold during the loop: never apply migrations (the owner runs `pnpm db:push --yes`), never run `pnpm worker:once` unasked, no secrets in PRs or comments. Merging stays the owner's call.

## Session handoffs

Handoff documents never go in this repo. Follow the owner's handoff rules ([mattpocock/skills, productivity/handoff](https://github.com/mattpocock/skills/tree/main/skills/productivity/handoff)): write the document to the OS temp directory (`$TMPDIR`, else `/tmp`), include a "suggested skills" section, reference PLAN.md, commits and other artifacts by path or URL instead of copying them, and redact secrets and personal information. Anything that should outlive the session belongs in PLAN.md or this file instead.
