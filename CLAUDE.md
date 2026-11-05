# CLAUDE.md — Working rules for Shift

Claude Code reads this file automatically. Follow it on every task in this repo.

## What this project is
Shift turns 0G compute credits that would expire at 00:00 UTC into useful, verifiable work.
Built for ETHGlobal Mumbai 2026 (0G "Build with 0G PC" prize + ETHGlobal finalist).

## Read before working
1. `docs/SHIFT_PLAN.md` — the full plan (source of truth for scope, architecture and rules). Spanish.
2. `PROGRESS.md` — what is done, what is next. Always work on the next unchecked item unless the user says otherwise.
3. `docs/STRUCTURE.md` — where every file goes.
4. `docs/PHASE0_KIT.md` — how to run the Phase 0 verification kit.

When a phase starts, re-read its section in `docs/SHIFT_PLAN.md` before writing code.

## Non-negotiable rules
- **No mocked execution.** Never fake responses, balances, request IDs, transactions or storage roots. If something does not work, it fails visibly and the failure is recorded in `PROGRESS.md`. (0G's DevRel asked for this explicitly.)
- **Verify before building.** Items marked `[VERIFICAR]` in the plan must be confirmed in Phase 0 (or by reading the official OpenAPI spec) before code depends on them. The OpenAPI spec wins over the plan.
- **Secrets:** never print, log, commit or send to the browser any `mk-`/`sk-` key or private key. `.env` is never committed.
- **TypeScript strict** everywhere; validate external input with `zod`.
- **Ask the user before:** spending credits beyond a tiny test call, deploying contracts, running a real nightly batch, force-pushing, deleting files outside the current task, or adding a new paid service.

## Workflow for every item
1. Pick the next unchecked item in `PROGRESS.md`. Tell the user which one.
2. Implement only that item (plus the tests it needs).
3. Run checks: `typecheck`, relevant unit tests, `forge test` if contracts changed.
4. Update `PROGRESS.md` **in the same commit**: tick the item, add the short commit hash after pushing is not required (git log has it), and add a one-line note if anything changed versus the plan (decision, fallback used, known limitation).
5. Commit following the commit rules below. Push.
6. Summarize to the user in 2–4 lines: what was done, what is next.

## Commit rules (the history is part of the ETHGlobal presentation)
- **Target for the whole project: 50–90 commits.** Never a single giant commit; never hundreds of tiny ones.
- **One commit = one item of `PROGRESS.md`** (a coherent unit that builds and passes checks). If an item is large, split it into 2–3 commits that each build.
- **Size guide:** roughly 50–400 lines of hand-written code per commit. Lockfiles, generated types and assets do not count.
- **No noise commits.** Typo or small fixes to the last unpushed commit go into it (`git commit --amend`) instead of a new commit. Fixes to pushed work use one `fix:` commit, not several.
- **Conventional Commits, in English, imperative, ≤ 72 chars:**
  `feat(core): add budget optimizer with greedy upgrades`
  Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`. Scopes: `core`, `web`, `worker`, `contracts`, `db`, `scripts`, `spike`.
- Body (optional, 1–3 lines) explains *why*, especially when deviating from the plan.
- **Do not add any AI attribution lines** to commit messages or PR descriptions (no `Co-Authored-By`, no "Generated with"). AI usage is disclosed once, in the README section "How we used AI", as ETHGlobal requires.
- Never rewrite pushed history unless the user asks.
- Commit steadily as work progresses; never batch a day of work into one commit.

## Language
- Code, comments, commit messages, `README.md`, `PROGRESS.md`: **English** (public, judges read them).
- Conversation with the user: **Spanish**.
- `docs/SHIFT_PLAN.md`: Spanish (internal plan).

## Definition of done for the project
See section 25 of `docs/SHIFT_PLAN.md` (submission checklist) and the final phase in `PROGRESS.md`.
