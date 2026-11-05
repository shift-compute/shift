# Repository structure

The repo starts as the **Phase 0 kit** and becomes a **pnpm monorepo** in the first Phase 1 commit (`PROGRESS.md` → F1.1). Every new file must go where this document says.

## Today (Phase 0 kit)

```
shift/
├── CLAUDE.md                 # Working rules for the AI (read automatically by Claude Code)
├── PROGRESS.md               # Living checklist: done / next / decisions / blockers
├── README.md                 # Public, judge-facing README (filled in during Phase 6)
├── LICENSE                   # MIT
├── .env.example              # Variables for Phase 0
├── package.json              # Phase 0 scripts (smoke, inspect-openapi, merkle-vector)
├── tsconfig.json
├── scripts/
│   ├── smoke.ts              # Real checks U1–U8 against the 0G Router
│   ├── inspect-openapi.ts    # Extracts exact schemas from the official OpenAPI
│   ├── merkle-vector.ts      # TS Merkle test vector for the parity test
│   └── lib/                  # http, hash, redact helpers
├── contracts/                # Foundry project
│   ├── src/ShiftLedger.sol
│   ├── test/ShiftLedger.t.sol
│   └── script/Deploy.s.sol
└── docs/
    ├── SHIFT_PLAN.md         # Full plan
    ├── STRUCTURE.md          # This file
    ├── PHASE0_KIT.md         # How to run Phase 0
    └── spike/                # Phase 0 outputs (no secrets): merkle-vector.json, models.json, SPIKE_RESULTS.json
```

## Target (after F1.1)

```
shift/
├── CLAUDE.md
├── PROGRESS.md
├── README.md
├── LICENSE
├── .env.example              # All variables (plan, section 20)
├── package.json              # Workspace root: scripts only (dev, build, typecheck, test, smoke)
├── pnpm-workspace.yaml       # apps/*, packages/*
├── tsconfig.base.json        # Shared strict config
├── apps/
│   ├── web/                  # Next.js 15: UI + internal API (route handlers)
│   │   ├── app/              # Pages: /, /connect, /queue, /nights/[id], /commons, /verify
│   │   │   └── api/          # Route handlers (plan, section 17)
│   │   ├── components/       # UI components (one folder per page area)
│   │   ├── lib/              # session, auth, server-only helpers
│   │   └── styles/           # design tokens (plan, section 18.2)
│   └── worker/               # Node process: cron, night pipeline, sweeper
│       └── src/
│           ├── index.ts
│           ├── pipeline/     # runNight, runUser, commons, anchor
│           └── sweeper.ts
├── packages/
│   └── core/                 # Shared logic, no UI
│       └── src/
│           ├── zg/           # router client, generated types, models, decisions, storage, chain
│           ├── optimizer/    # estimator, quality table, allocation, replanning
│           ├── tasks/        # executors: audio-summary, doc-analysis, image-from-prompt
│           ├── merkle/       # leaf encoding (LEAF_TYPES), tree, proofs
│           ├── crypto/       # vault (AES-256-GCM)
│           └── config.ts     # zod-validated env
├── prisma/
│   └── schema.prisma
├── contracts/                # unchanged location
├── scripts/                  # unchanged location (smoke, inspect-openapi, merkle-vector, seed-commons, e2e)
├── data/
│   └── commons/              # source paragraphs + LICENSE note
└── docs/
    ├── SHIFT_PLAN.md
    ├── STRUCTURE.md
    ├── PHASE0_KIT.md
    ├── SPIKE_RESULTS.md      # Human summary of Phase 0 (created in F0)
    ├── DECISIONS.md          # Only if decisions outgrow PROGRESS.md
    └── spike/
```

## Rules
- **Where code goes:** anything used by both web and worker lives in `packages/core`. Next.js-only code stays in `apps/web`. Cron and batch logic stays in `apps/worker`.
- **One concern per file.** No `utils.ts` dumping grounds; name files by what they do (`ephemeral-keys.ts`, `cost-estimator.ts`).
- **Tests next to the code** they test (`*.test.ts`), contracts tests in `contracts/test/`.
- **Generated files** (OpenAPI types) go in `packages/core/src/zg/generated/` and are committed, with a header saying how to regenerate them.
- **Docs:** only the files listed above. Do not create new top-level markdown files; add sections to existing ones.
- **Migration (F1.1):** move nothing out of `scripts/` and `contracts/`; convert the root `package.json` into the workspace root, add `pnpm-workspace.yaml`, create `apps/` and `packages/` with their own `package.json`, and keep `npm run smoke` working as `pnpm smoke`.
