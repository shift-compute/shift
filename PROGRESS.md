# Shift — Progress

Living status of the build. Updated in the same commit as the work it describes.
Plan: [`docs/SHIFT_PLAN.md`](docs/SHIFT_PLAN.md) · Structure: [`docs/STRUCTURE.md`](docs/STRUCTURE.md)

**Current phase:** F0 — Verification spike
**Next item:** F0.2
**Commits so far:** 1 (target for the project: 50–90)

Legend: `[ ]` to do · `[x]` done · `[~]` done with a fallback or limitation (see note) · `[-]` dropped (see note)

Each item is one commit unless marked *(2 commits)*. The text after the item is the suggested commit message.

---

## F0 — Verification spike (plan §21)
- [x] F0.1 Initial repo: Phase 0 kit, plan, project rules — `chore: initial repo with phase 0 kit, plan and project rules`
- [ ] F0.2 OpenAPI excerpt: key limit field, `/v1/decisions` schema (U2, U7) — `docs(spike): add OpenAPI excerpt for keys and decisions`
- [ ] F0.3 Run smoke tests U1–U8 and save results — `test(spike): run router smoke tests and record results`
- [ ] F0.4 Contract tests green with forge — `test(contracts): verify ShiftLedger tests and merkle parity`
- [ ] F0.5 0G Storage upload/download check (U9) — `test(spike): verify 0G Storage upload and download`
- [ ] F0.6 Deploy ShiftLedger (U10) — `feat(contracts): deploy ShiftLedger to 0G`
- [ ] F0.7 `docs/SPIKE_RESULTS.md` + decisions from U1–U12 — `docs(spike): summarize results and decisions`

## F1 — Structure and account connection (plan §6, §7, §8)
- [ ] F1.1 Monorepo migration per `docs/STRUCTURE.md` — `chore: restructure into pnpm monorepo`
- [ ] F1.2 Env config with zod (plan §20) — `feat(core): add validated env config`
- [ ] F1.3 Generated Router types from OpenAPI — `feat(core): generate 0G Router types from OpenAPI`
- [ ] F1.4 Router client: sk-/mk-, errors (§7.5), trace capture — `feat(core): add 0G Router client with error mapping`
- [ ] F1.5 AES-256-GCM vault for mk- keys — `feat(core): add encrypted vault for management keys`
- [ ] F1.6 Ephemeral key lifecycle: create, revoke, sweep helper — `feat(core): add ephemeral key lifecycle`
- [ ] F1.7 Prisma schema + first migration (§16) — `feat(db): add prisma schema and initial migration`
- [ ] F1.8 Web shell: Next.js app, design tokens, fonts (§18.2) — `feat(web): add app shell and design tokens`
- [ ] F1.9 Connect API: scope validation + probe key (§8.1) — `feat(web): add connect endpoint with scope checks`
- [ ] F1.10 Connect wizard page — `feat(web): add connect wizard`
- [ ] F1.11 Session + account balance endpoint — `feat(web): add session and balance endpoint`
- [ ] F1.12 Home page with live countdown to 00:00 UTC — `feat(web): add home with reset countdown`

## F2 — Execution (plan §9, §11, §13)
- [ ] F2.1 Tasks API with uploads and validation — `feat(web): add tasks api with uploads`
- [ ] F2.2 Queue page — `feat(web): add queue page`
- [ ] F2.3 AUDIO_SUMMARY executor — `feat(core): add audio summary executor`
- [ ] F2.4 DOC_ANALYSIS executor — `feat(core): add document analysis executor`
- [ ] F2.5 IMAGE_FROM_PROMPT executor — `feat(core): add image from prompt executor`
- [ ] F2.6 0G Storage client for outputs — `feat(core): add 0G Storage client`
- [ ] F2.7 Worker: cron, night lock, runUser pipeline *(2 commits)* — `feat(worker): add scheduler and night lock` / `feat(worker): add per-user night pipeline`
- [ ] F2.8 Key sweeper — `feat(worker): add ephemeral key sweeper`
- [ ] F2.9 Run-now endpoint using the real pipeline — `feat(web): add run now endpoint`
- [ ] F2.10 Unit tests: vault, executors' parsing, redaction — `test(core): cover vault, executors and log redaction`

## F3 — Optimizer and anchoring (plan §10, §14, §15)
- [ ] F3.1 Model catalog loader + price normalization to micro-USD — `feat(core): add model catalog and pricing`
- [ ] F3.2 Cost estimator — `feat(core): add cost estimator`
- [ ] F3.3 Complexity classification with decision models — `feat(core): classify task complexity with decision models`
- [ ] F3.4 Budget optimizer (base + greedy upgrades) — `feat(core): add budget optimizer`
- [ ] F3.5 Adaptive replanning during execution — `feat(core): replan when real cost drifts`
- [ ] F3.6 Optimizer tests — `test(core): cover optimizer edge cases`
- [ ] F3.7 Plan preview endpoint + UI — `feat(web): add tonight's plan preview`
- [ ] F3.8 Merkle leaves and tree (LEAF_TYPES, parity) — `feat(core): add merkle leaf encoding and tree`
- [ ] F3.9 Night manifest + anchorNight on 0G Chain — `feat(worker): anchor nightly batch on 0G Chain`
- [ ] F3.10 Night results page with provenance cards — `feat(web): add night results with provenance`
- [ ] F3.11 Verify API + page with client-side on-chain check *(2 commits)* — `feat(web): add verify api` / `feat(web): add verify page with on-chain check`
- [ ] F3.12 **Checkpoint H20:** real end-to-end run recorded below — `docs: record first real end-to-end run`

## F4 — Commons (plan §12)
- [ ] F4.1 Seed source paragraphs with license note — `feat(scripts): seed commons sources`
- [ ] F4.2 Translation A/B — `feat(worker): add commons translations`
- [ ] F4.3 Decision-model quality gate — `feat(worker): add commons quality gate`
- [ ] F4.4 Donation accounting + recordDonations — `feat(worker): record compute donations on-chain`
- [ ] F4.5 Commons page — `feat(web): add commons page`
- [ ] F4.6 Night strip (signature UI element) — `feat(web): add night strip timeline`
- [ ] F4.7 Real nightly run (Nov 7, 04:30–05:20 IST) recorded below — `docs: record nightly run results`

## F5 — Optional (only if F3.12 passed on time; plan §3 "Could")
- [ ] F5.1 Sealed-box encryption of personal outputs (C1)
- [ ] F5.2 Arkiv queue mirror + `/arkiv/*.md` files (C2, plan Appendix A) *(2–3 commits)*
- [ ] F5.3 Responsive, accessibility, reduced motion polish — `fix(web): polish responsive and accessibility`

## F6 — Delivery (plan §24, §25)
- [ ] F6.1 Deploy web + worker + Postgres; live demo link — `chore: deploy web and worker`
- [ ] F6.2 README for judges — `docs: write README for judges`
- [ ] F6.3 Request ID table, contract and storage links in README — `docs: add verifiable run evidence`
- [ ] F6.4 Demo video link + submission details — `docs: add demo video and submission info`

Planned commits: ~58 + a few `fix:` commits = within the 50–90 target.

---

## Phase 0 results (filled in F0.3–F0.7)
| ID | Check | Result | Decision / fallback |
|---|---|---|---|
| U1 | Credits visible as `credit_balance` | | |
| U2 | Key create fields (limit, `trust_mode`) | | |
| U3 | Inference spends credit, not deposit | | |
| U4 | Revocation is immediate | | |
| U5 | `GET /v1/account` address + currency | | |
| U6 | Catalog: TeeML models, pricing units | | |
| U7 | `/v1/decisions` schema + model IDs | | |
| U8 | `x_0g_trace` with `verify_tee` | | |
| U9 | 0G Storage upload/download | | |
| U10 | Chain ID, RPC, deploy | | |
| U11 | Submission deadline | | |
| U12 | 0G OK with delegated iAI credit use | | |

## Real runs (evidence for judges)
| Date (UTC) | Night ID | Tasks | Request IDs (sample) | Anchor tx | Manifest root |
|---|---|---|---|---|---|
| | | | | | |

## Decisions log
Short entries: date — decision — reason. Example: `2026-11-06 — budget mode is primary — U1 failed (credits not separable)`.

## Blockers
- None yet.
