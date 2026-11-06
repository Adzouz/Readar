# AGENTS.md

Guide for coding agents and contributors working on Readar.

**Start here:** [PLAN.md](PLAN.md) has the decisions and why (§3), what comes next in order and the known limitations (§11). Read it before changing behavior.

## Layout

| Path                         | Role                                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| `apps/client`                | React app (Vite) shared by the Mac app, the iPhone app and the web app   |
| `apps/client/src/theme`      | Theme tokens (`themes.css`), theme store, `ThemeScope`, light/dark mode  |
| `apps/client/src/deck`       | Deck store (zustand), cards per theme, swipe gestures, keyboard, lists   |
| `apps/client/src/shell`      | App layout per theme, navigation, settings, toasts                       |
| `apps/client/src/onboarding` | Setup flow (style, topics, sources), setup store, deck wiring            |
| `apps/client/src/data`       | Topic catalog with suggested feeds; sample cards until fetching is wired |
| `apps/client/src-tauri`      | Tauri 2 shell for macOS and iOS                                          |
| `scripts/check-feeds.ts`     | Health check for every catalog feed (`pnpm check:feeds`)                 |
| `scripts/ui`                 | Layout check and screenshots against the dev server (Playwright, Chrome) |
| `docs/brief.html`            | Source of the product brief page (published as a claude.ai artifact)     |

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
pnpm check:feeds  # fetch every catalog feed; run after editing data/catalog.ts
pnpm ui:check     # with pnpm dev running: no screen overflows the window
pnpm ui:shots     # with pnpm dev running: screenshots into .screenshots/
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
- Persisted client state: `readar.theme` (style, mode) and `readar.setup` (onboarding step, topics, keyword watches, disabled sources, user links). `index.html` reads `readar.theme` before first paint, so keep its shape.
- Respect `prefers-reduced-motion`: gestures still work, animations are skipped.
- Glass effects are CSS only (no macOS private APIs), to keep the Mac App Store possible.

## Claude

- MVP rule: every user brings their own Claude Console API key. It stays on the device (keychain on Mac and iPhone, browser storage on web) and summaries are written from the device. Do not add server-side Claude calls or a shared summary cache.
- Never offer Claude.ai login or use Claude subscription credentials: Anthropic forbids it for third-party apps.
- Model: `claude-sonnet-5-5`, the owner's choice; don't change it without asking. Use the official TypeScript SDK and check current docs before writing API code (sampling parameters and `thinking: disabled` are rejected).

## Secrets

- Env files are gitignored; only `*.env.example` is committed. `apps/client/.env.local` holds the Supabase URL and publishable key.
- Never paste or log the Supabase secret key, the database password or a Claude API key.

## Tooling notes

- The owner's shell has an RTK hook that rewrites some commands (`curl`, `grep`, `cat`, `ls`) and filters their output. Use `rtk proxy <command>` for raw output. Don't pipe `curl` into `sh`: download to a file first. If `pnpm lint` prints "Linter process terminated abnormally", run `rtk proxy ./node_modules/.bin/oxlint --deny-warnings .` to see the real result.
- Claude Code memory for this project is keyed to the folder path (`…/apps/sonar`); renaming the folder starts a fresh memory.

## Session handoffs

Handoff documents never go in this repo. Follow the owner's handoff rules ([mattpocock/skills, productivity/handoff](https://github.com/mattpocock/skills/tree/main/skills/productivity/handoff)): write the document to the OS temp directory (`$TMPDIR`, else `/tmp`), include a "suggested skills" section, reference PLAN.md, commits and other artifacts by path or URL instead of copying them, and redact secrets and personal information. Anything that should outlive the session belongs in PLAN.md or this file instead.
