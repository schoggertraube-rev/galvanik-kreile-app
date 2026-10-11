---
name: b1-storno-ci-wiring-oscillation
description: The F1.4 Storno CI step in quality.yml was added (round 3), removed on Owner/PL scope instruction (round 4), re-demanded by review (round 5); since 2026-09-27 it IS committed (0d3bacc6) on kr-b1-storno-p0 and inherited by the B2 branch — open Owner escalation
metadata:
  type: project
---

On branch `claude/kr-b1-storno-p0` the blocking CI step
"F1.4 Storno payment-gate DB guard on the current schema" in
`.github/workflows/quality.yml` has been added, removed and re-added across review
rounds: inserted in round 3, reverted in round 4 on Owner/PL instruction (reason
given: CI wiring should be its own follow-up package, scope separation), then
demanded again by the round-5 P1 review finding on PR #114. As of 2026-09-27 this
reversal of an Owner decision is **unresolved** and belongs to the Owner/PL, not to
writer or reviewer.

CORRECTION 2026-09-28 (supersedes the earlier "never committed" note): the step IS
now committed. `git log --all -S "F1.4 Storno payment-gate" -- .github/workflows/quality.yml`
returns exactly one commit, `0d3bacc6` ("kreile: Paket B1 P0-Storno."), reachable from
`claude/kr-b1-storno-p0` AND — via branch stacking — from
`claude/kr-b2-auftrag-zeitpunkte` (both pushed to origin). So the round-5 demand was
satisfied in code, but the round-4 Owner veto on exactly this change was never
formally withdrawn. The oscillation is now partly reconstructable from git; the
round-4 removal still is not.

**Why:** Without this note a future agent re-derives the step from scratch, sees a
clean git history, and cannot tell that an Owner already vetoed exactly this change
once. That turns a governance question into a silent technical re-decision — which
AGENTS.md forbids (`BLOCKED_GOVERNANCE_CONFLICT`, no quiet priority call).

**How to apply:** When a review finding asks to wire this test (or any CI step) into
`quality.yml` on a B1/Storno package, first surface the round-4 Owner instruction as
an open escalation point and ask for an explicit Owner ruling; do not close the
finding as done on engineering grounds alone. Note also that any byte change to
`quality.yml` forces a `judgeContractHash` update in `quality/eslint-baseline.json`,
so the two files always travel together. Related:
[[g07-dossier-not-authoritative]].
