---
name: readar-pr-re-review
description: Re-review a Readar pull request after fixes were pushed — check every earlier finding against the code, review only what changed since the last reviewed commit, rerun the gates, and give a new GO / GO WITH NITS / NO GO verdict with a Done / Another round loop state. Use after readar-address-comments, and repeat until nothing is left to address.
---

# readar-pr-re-review

Adapted from PRism's `prism-pr-re-review`. Incremental pass: same rules, dimensions, verdict rules and report conventions as `readar-pr-review` — read that skill if you do not have it in context.

## Input

PR number on `Adzouz/Readar`. The earlier findings come from the review threads on the PR:

```bash
gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){headRefOid baseRefName reviews(last:20){nodes{commit{oid} submittedAt author{login} body}} reviewThreads(first:100){nodes{id isResolved isOutdated path line comments(first:20){nodes{databaseId author{login} body createdAt}}}}}}}' -F o=Adzouz -F r=Readar -F n=<N>
```

The last reviewed commit is the `commit.oid` of the latest review that raised findings. If the earlier review was only reported in a session and never posted, ask the user for it (or for the reviewed sha) instead of guessing.

## 1. Prior findings

For each earlier finding, read the current code and every reply in its thread. Mark it:

- **resolved** — the code now handles the failure scenario (cite `path:line`), ideally with a test (name it).
- **still_open** — not fixed, or fixed partly (say what is missing).
- **disputed** — the author pushed back; quote the reply and give your view with evidence. The user decides.
- **obsolete** — the code is gone or the finding no longer applies.

Do not mark resolved because a thread is resolved; check the code.

## 2. Delta review

```bash
gh pr checkout <N>   # only if the tree is clean; otherwise work from the diff
git fetch origin
git log --oneline <last_reviewed>..<head>
git diff <last_reviewed>..<head>
git range-diff <old_base>..<last_reviewed> <new_base>..<head>   # after a rebase/force-push
```

Review only the real changes since the last reviewed commit (skip commits that only moved because of a rebase, and base-only merges). Fixes often introduce new edge cases: check them with the same dimensions (RLS and grants, secrets, Claude key rules, sync races, theme and layout rules, docs). Do not raise anything already in the prior findings. If the delta rewrites more than ~40% of the PR or changes its scope, say so and recommend a full `readar-pr-review`.

Run the gates again:

```bash
pnpm format:check
rtk proxy ./node_modules/.bin/oxlint --deny-warnings .
pnpm typecheck
pnpm test
pnpm build
```

Plus the conditional ones from `readar-pr-review` when the delta touches their area: `pnpm check:feeds`, `pnpm ui:check` + `pnpm ui:shots` (reuse the dev server on :1420), `cargo check`, `pnpm db:push --dry-run` (never apply migrations).

## 3. Report

```markdown
# Re-review PR #<N> — <last_reviewed sha7>..<head sha7>

## Verdict: ✅ GO | ⚠️ GO WITH NITS | ⛔ NO GO

## Review status: Approve | Comment | Request changes

## Prior findings

| Finding             | Status                                      | Evidence                         |
| ------------------- | ------------------------------------------- | -------------------------------- |
| `path:line` <title> | resolved / still_open / disputed / obsolete | `path:line`, test name, or reply |

## New findings

- `path:line` — <problem> → <fix> (failure: <scenario>)

## Gates

format · lint · typecheck · tests · build · <conditional gates run>

## Loop state

- **Done** — nothing left to address before merge. / **Another round** — <n> items to address: <list>.
```

Then ask: **"Do you want me to comment these on the PR?"** Same posting rules as `readar-pr-review`: one review, inline comments, only on yes, `review.json` in the scratchpad. When the user agrees, also reply under each resolved thread with the commit that fixed it, ending with `_Reply drafted by AI, reviewed by the author._`, and leave resolving to the user.

## Loop

**Another round** → `readar-address-comments` on the open items, then this skill again. **Done** → the PR is ready to merge; merging is the user's call.
