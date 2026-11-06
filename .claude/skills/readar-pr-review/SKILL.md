---
name: readar-pr-review
description: Review a Readar pull request in one pass — correctness, regressions, tests, security (Supabase RLS and grants, secrets, Claude key rules, Tauri), fetch and API budget, themes and layout rules, UX and repo hygiene — and end with a GO / GO WITH NITS / NO GO verdict, a review status, and the question whether to comment the PR. Use for any PR on the Readar repository (Adzouz/Readar).
---

# readar-pr-review

Single pass. Gather everything, analyze, report. **Never post anything unless the user says yes at the end.**

Adapted from PRism's `prism-pr-review`. Project rules live in `AGENTS.md` and `PLAN.md`; when they disagree with this file, they win.

## Input

A PR number or URL on `Adzouz/Readar`.

## 1. Gather (parallel)

```bash
gh pr view <N> --json number,title,body,author,state,isDraft,baseRefName,headRefName,headRefOid,additions,deletions,changedFiles,files,labels,comments,reviews,commits
gh pr diff <N>
gh api repos/{owner}/{repo}/pulls/<N>/comments --paginate
gh pr checks <N>
```

Read the body, every comment and every review thread before judging. Do not repeat a point already raised; if an earlier finding is still open, say so once. Note the PR type (fix / feature / refactor / chore) and which `PLAN.md` §11 step or phase it belongs to.

## 2. Read the code

Check out the PR if the tree is clean (`gh pr checkout <N>`), else work from the diff. Read whole files for non-trivial changes, plus the callers and types the diff depends on. Compare behaviour with `PLAN.md` (decisions §3, data model §8, next steps and known limitations §11) and the conventions in `AGENTS.md`.

Areas to map before analyzing:

| Area               | Where                                                                           |
| ------------------ | ------------------------------------------------------------------------------- |
| Shared code        | `packages/core` (catalog, URL helpers, types)                                   |
| Database           | `supabase/migrations/*.sql`, `apps/client/src/lib/database.ts`                  |
| Sync               | `apps/client/src/sync` (session, setup, decks and lists, outbox, sign-in links) |
| Deck and UI        | `apps/client/src/deck`, `shell`, `onboarding`, `theme`                          |
| Worker             | `apps/worker/src`                                                               |
| Mac / iPhone shell | `apps/client/src-tauri`                                                         |

## 3. Verify (when checked out)

```bash
pnpm install
pnpm format:check
rtk proxy ./node_modules/.bin/oxlint --deny-warnings .   # same as pnpm lint, real output
pnpm typecheck
pnpm test
pnpm build
```

Run these too when the diff touches the matching area:

| Diff touches                                                | Run                                                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/catalog.ts`                              | `pnpm check:feeds`                                                                                                                                                        |
| UI (`apps/client/src/**/*.tsx`, `themes.css`, `styles.css`) | With the dev server on :1420 (reuse the owner's, never stop it): `pnpm ui:check`, then `pnpm ui:shots` and look at the images (three styles, light and dark, phone width) |
| `apps/client/src-tauri`                                     | `. "$HOME/.cargo/env" && (cd apps/client/src-tauri && cargo check)`                                                                                                       |
| `supabase/migrations`                                       | `pnpm db:push --dry-run` (only lists pending migrations). **Never apply migrations**: the owner runs `pnpm db:push --yes`                                                 |
| `apps/worker`                                               | `pnpm worker:once` only if the user asks: it writes to the real database                                                                                                  |

Report results honestly. A failing gate is blocking.

## 4. Analyze, every dimension

Every finding cites `path:line` (new-file line numbers) with a concrete failure scenario: input/state → wrong result.

1. **Correctness & intent** — does it do what the PR claims? Edge cases, null paths, races (overlapping `loadContent` runs, outbox flush during a reload, account switch mid-sync, StrictMode double effects, double clicks), wrong state precedence (local pending changes vs the server copy), off-by-one. Say plainly if the approach is wrong or over-built.
2. **Regressions** — what existing behaviour changes? Trace callers. Check:
   - Persisted keys and shapes (`readar.theme`, `readar.setup`, `readar.sync`, `readar.deck`, `readar.outbox`, `readar.auth`). `index.html` reads `readar.theme` before first paint.
   - Catalog source and topic ids (stored in `disabled_source_ids`, `user_topics`, `topic_sources`).
   - Supabase function signatures the client calls (`get_setup`, `save_setup`, `deck`, `list_items`) against `database.ts`.
   - Keyboard map and actions, identical in all three styles.
3. **Tests** — a fix needs a test that fails without it. A feature needs happy path + edge + error. Pure logic goes in pure functions with vitest tests (`createDeckStore`, `parseEntries`, `stampFor`, URL helpers). No network in tests: feed parsing uses fixtures. Assertions check behaviour, not mocks.
4. **Security**
   - **Supabase:** RLS enabled on every new table. Per-user tables have `(select auth.uid()) = user_id` policies. Shared tables (topics, sources, items…) get no client grants and are read only through `security definer` functions with `set search_path = ''`, fully qualified names and `auth.uid()` filters. `revoke … from public, anon` on every new function; grants are explicit (the project doesn't expose new tables). Nothing lets one user read another user's links, lists or summaries.
   - **Secrets:** no `DATABASE_URL`, Supabase secret key, database password, Claude API key, YouTube key or Resend key in code, tests, fixtures, logs or docs. Only `*.env.example` is committed. The client gets only the publishable key.
   - **Claude rules (AGENTS.md):** the user's own Console API key stays on the device (keychain on Mac and iPhone, browser storage on web). No server-side Claude calls, no shared summary cache, no Claude.ai login or subscription credentials. Model `claude-sonnet-5-5` unless the owner changed it.
   - **Tauri:** capabilities stay minimal; CSP not widened without reason (it must be strict before API keys land); deep-link and `/auth` inputs validated (`parseAuthLink`), tokens kept out of history and logs.
   - **Worker:** fetched HTML and feed content is never rendered as HTML in the client. Identifiable user agent, timeouts, body size cap, robots.txt for article pages. User-added links are fetched by the worker: watch for requests to private or local addresses once it runs on a host.
5. **Fetch & API budget** — feed polling (adaptive interval, conditional GET, backoff), only followed sources claimed, entries per fetch capped. Google News decoding costs two requests per new link (aliases prevent repeats). YouTube Data API quota (10,000 units/day). Supabase calls per swipe (outbox batching) and per load (one `deck` call per topic). Claude tokens per card once summaries land (≈ $9 per 1,000 summaries, paid by the user).
6. **Data model & migrations** — schema changes only in a **new** file in `supabase/migrations/` (never edit an applied migration). `database.ts` updated to match. FKs and `on delete` behaviour intended; no destructive change without a plan for existing rows. `PLAN.md` §8 updated.
7. **Themes & styling** — no hard-coded theme colors in components: tokens in `themes.css` in all six style × mode blocks, mapped in `styles.css`. Themes change look and feel only: features, routes and keyboard map identical; structural differences in variant components picked with `useStyle()`. Glass effects stay CSS-only.
8. **Layout** — the page never scrolls (`html, body { overflow: hidden }`); every scroll area is `relative`. Dialogs fit short windows (`max-h-full` + inner scroll). Page overflow shows as a double scrollbar in the Mac app even when screenshots look fine.
9. **UX** — keyboard shortcuts work and show their hints on desktop in every style; buttons for people who don't swipe; loading, empty and error states; honest copy (no invented numbers or times); the AI badge only on real Claude summaries; offline keeps working from the local cache. `prefers-reduced-motion` respected (gestures still work, animations skipped).
10. **Accessibility** — semantic elements, labels on icon buttons, `aria-*` on dialogs and progress bars, focus management in dialogs, no colour-only signals.
11. **React & state** — zustand selectors return stable references (derive in the component body); no `useX.getState()` in a component body; effects cleaned up; no work per render on large lists.
12. **Repo hygiene** — no personal data (emails, real user ids, names) in code, tests, fixtures, docs or screenshots; generic examples only. Minimal comments that explain why. Conventional-commit subjects. Handoff documents never in the repo.
13. **Refactors** — only when they clearly simplify or remove duplication.
14. **Docs** — updated in the same PR when it changes architecture, commands, conventions, persisted state, data model or step status: `AGENTS.md` (layout, commands, conventions, secrets), `PLAN.md` (§8 data model, §11 next up and known limitations), `README.md`. Missing update = nit marked _Address before merge_.

## 5. Report

```markdown
# PR #<N> — <title>

**Type:** fix|feature|refactor|chore · **Branch:** <head> → <base> · **+<a> −<d>, <n> files** · **Head:** <sha7> · **PLAN step:** <§11 step or phase>

## Verdict: ✅ GO | ⚠️ GO WITH NITS | ⛔ NO GO

<one line why>

## Review status: Approve | Comment | Request changes

<one line why>

## Summary

<2–4 lines: what it does, does it deliver>

## Blocking

- `path:line` — <problem> → <fix> (failure: <scenario>)

## Non-blocking

- `path:line` — <problem> → <suggestion>

## Dimension scan

- Correctness: …
- Regressions: …
- Tests: <adequate|gaps> — regression test for each fix? <yes/no>
- Security (RLS/grants, secrets, Claude rules, Tauri, worker): …
- Fetch & API budget: …
- Data model / migrations: …
- Themes / layout: …
- UX / a11y: …
- Docs: AGENTS.md / PLAN.md / README <up to date|missing: …>
- Gates: format <✓/✗> · lint <✓/✗> · typecheck <✓/✗> · tests <n passed/✗> · build <✓/✗> · ui:check <✓/✗/n.a.> · check:feeds <✓/✗/n.a.> · cargo check <✓/✗/n.a.> · db:push --dry-run <✓/✗/n.a.>

## Should the nits be addressed?

- `path:line` — <nit> → **Address before merge** | **Follow-up is fine** | **Skip** — <why>
  **Recommendation:** Comment | Approve
```

### Verdict rules

- **⛔ NO GO** — any blocking finding: correctness bug, regression, security issue (missing RLS or grant revoke, secret in the diff, Claude key leaving the device), fix without regression test, failing gate, schema change without a migration or with an edited applied migration, personal data in the diff.
- **⚠️ GO WITH NITS** — safe to merge, only non-blocking findings.
- **✅ GO** — clean, tested, nothing to change.

### Review status rules

- **Request changes** — any blocking finding.
- **Comment** — no blocking finding but at least one nit marked _Address before merge_.
- **Approve** — nothing to change before merge. (GitHub refuses Approve and Request changes on your own PR: post as Comment and state the verdict in the body.)

Be direct. Signal over volume: merge findings that share a root cause.

## 6. Ask: comment the PR?

End with exactly one question:

> Do you want me to comment these findings on the PR?

- No answer or **no** → stop. Nothing is posted.
- **Yes** → post one review with an inline comment per finding (blocking + nits marked _Address before merge_), event `COMMENT` unless the user picks another status. Anchor on lines present in the diff at the reviewed head:

```bash
gh api repos/{owner}/{repo}/pulls/<N>/reviews --input review.json
# {"commit_id": "<head sha>", "event": "COMMENT", "body": "<verdict + summary>",
#  "comments": [{"path": "...", "line": 42, "side": "RIGHT", "body": "**<title>.** <problem, failure scenario, fix>"}]}
```

Write `review.json` in the scratchpad, not in the repo. Each comment: bold title, the problem, the failure scenario, the fix. Then give the review URL.

## Loop

Posted findings are the input of `readar-address-comments`. After the fixes are pushed, run `readar-pr-re-review`. Repeat until the verdict is ✅ GO or ⚠️ GO WITH NITS with nothing marked _Address before merge_.
