---
name: readar-address-comments
description: Fix the review findings on a Readar pull request — rebase on the real base, give each named thread a verdict (fix / push back / defer), implement with tests, run every gate, then stop and hand commit + push to the user; reply only after the push, and only on the threads the user picks. Use when the user asks to address review comments on a Readar PR.
---

# readar-address-comments

Adapted from PRism's `prism-address-comments`. Project rules live in `AGENTS.md` and `PLAN.md`; the review rules and dimensions are in `readar-pr-review`.

One PR. Two hard rules:

1. **Rebase on the PR's real base before touching code.**
2. **Never commit, push or reply on your own.** Stop after the fix; replies only after the user pushed, and only on the threads the user picked.

## Input

PR number on `Adzouz/Readar`, plus which threads to address. If none were named, list the unresolved threads (`path:line` + first line) and ask — do not assume "all".

```bash
gh pr view <N> --json number,title,baseRefName,headRefName,headRefOid,url
gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved isOutdated path line comments(first:20){nodes{databaseId body author{login}}}}}}}}' -F o=Adzouz -F r=Readar -F n=<N>
```

Keep each thread's first comment `databaseId` for replies later.

## 1. Rebase

Check the tree is clean first (`git status`); if not, ask before stashing anything.

```bash
gh pr checkout <N>
git fetch origin <baseRefName>
git rebase origin/<baseRefName>
pnpm install   # if the lockfile changed
pnpm test
```

Stacked PRs rebase on their parent branch, not `main`. If the rebase is messy, stop and say so before writing code.

## 2. Verdict per thread

- **Fix** — correct and in scope → implement.
- **Push back** — the comment is wrong or has a trap → explain with evidence (`path:line`, a failure scenario that cannot happen). Reviewers, including AI reviews, can be wrong.
- **Defer** — real but out of scope → propose a follow-up (an entry in `PLAN.md` §11 known limitations, or an issue) instead of growing the PR.

Show the plan first when a fix is non-trivial or a verdict is a push back. The owner likes decisions as a short question round with a recommended option.

## 3. Implement

- Smallest change that removes the failure scenario. No drive-by refactors.
- Each fixed bug gets a vitest test that fails without the fix. Keep logic in pure functions where possible; no network in tests (feed fixtures, store factories like `createDeckStore`).
- **Database:** schema changes go in a **new** file in `supabase/migrations/` (never edit an applied one), with RLS, explicit grants and `revoke … from public, anon` on new functions. Update `apps/client/src/lib/database.ts`. Check with `pnpm db:push --dry-run`; **the owner applies migrations** (`pnpm db:push --yes`).
- **UI:** theme tokens only (all six blocks in `themes.css`, mapped in `styles.css`); same features in all three styles; the page never scrolls; scroll areas are `relative`.
- **Secrets and personal data:** none in code, tests, fixtures, docs or screenshots. Claude key rules from `AGENTS.md` hold (key on the device, no server-side Claude calls).
- Minimal comments that explain why.
- Update `AGENTS.md`, `PLAN.md` (§8, §11) or `README.md` in the same change when a fix alters architecture, commands, conventions, persisted state, data model or known limitations.
- Run all gates and report them honestly:

```bash
pnpm format && rtk proxy ./node_modules/.bin/oxlint --deny-warnings . && pnpm typecheck && pnpm test && pnpm build
```

Plus, when the fix touches them: `pnpm check:feeds` (catalog), `cargo check` in `apps/client/src-tauri` (Tauri), and for UI with the dev server on :1420 (reuse the owner's, never stop it) `pnpm ui:check`, then `pnpm ui:shots` and look at the images in all three styles, light and dark, at phone width. Don't claim a UI fix works without seeing it.

## 4. Hand off

Report: rebase result, per-thread verdict and change (`path:line`), new tests, gate results, deferred or pushed-back items. Propose a conventional-commit subject (`fix: …`, short). Then ask the user to commit and push (`--force-with-lease` after a rebase). Do it yourself only if the user says so explicitly; then end the commit message with the attribution line from the session instructions, and verify the remote head afterwards (`git ls-remote origin <branch>`).

## 5. Replies — after the push, only picked threads

Ask which threads to answer. Draft each reply (what changed + commit sha, or the push-back reasoning), show them, post only on yes:

```bash
gh api repos/Adzouz/Readar/pulls/<N>/comments/<comment_id>/replies -f body="…

_Reply drafted by AI, reviewed by the author._"
```

Never reply about something that is not pushed yet. Resolving threads is the user's call.

## Next

Run `readar-pr-re-review` on the new head. Loop until it says **Done**.
