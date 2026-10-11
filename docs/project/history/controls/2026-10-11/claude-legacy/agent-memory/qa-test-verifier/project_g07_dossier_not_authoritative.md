---
name: g07-dossier-not-authoritative
description: G07 requirement IDs (K-G07-*, T-G07-*, OP-*) live only in _MODULDOSSIERS outside the repo and are anchored in no D-GOV-001 authoritative source — verified 2026-09-27
metadata:
  type: project
---

Requirement IDs of the form `K-G07-*`, `T-G07-*`, `A-G07-*`, `OP-*` come from
`_MODULDOSSIERS/G07_GELD_RECHNUNGEN/` and are anchored in **no** D-GOV-001
authoritative source. Verified 2026-09-27: `_MODULDOSSIERS` appears nowhere in
`AGENTS.md`, nowhere in `quality/authoritative-sources.json` (7 truthTypes), and
nowhere in the repo except agent-memory files written by the agents themselves.
`docs/project/CURRENT_STATE.md` contains no Storno/cancel entry at all.

**Why:** AGENTS.md / D-GOV-001 assign every truth type to exactly one source, and
the dossier folder is not one of them. So a dossier-derived `LIVE = NO_GO` bar is
real product intent but has no governance standing — a package built purely from a
dossier ID is executing outside the declared truth set. Separately, the
authoritative active-execution source `missions/F1_ORDER_TO_CASH_PILOT_001.yml`
still names `branch: path1/a2-phillip-recovery-20260919` /
`active_package: PATH1_UI_CONVERGENCE`, i.e. a different package than any
`claude/kr-b1-*` branch.

**How to apply:** When reviewing a package justified by a dossier ID, always
report the anchoring gap as an owner-level governance finding, and always
re-read the mission file to check whether the branch under review is the declared
active package. Do not treat the gap as FAIL_INTERNAL of the writer's code — it is
a decision the owner has to make (either promote the dossier into an authoritative
source or record the exception). Related: [[bibel-repo-divergence]].
