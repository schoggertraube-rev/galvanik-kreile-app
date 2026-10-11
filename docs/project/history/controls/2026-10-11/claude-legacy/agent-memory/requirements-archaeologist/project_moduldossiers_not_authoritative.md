---
name: project-moduldossiers-not-authoritative
description: _MODULDOSSIERS and all OE-2609-* owner decisions are anchored in NO D-GOV-001 authoritative source — recurring finding across G07/B1 and G04/B2, verified 2026-09-27
metadata:
  type: project
---

`_MODULDOSSIERS` is registered in **no** D-GOV-001 authoritative source, and the
`OE-2609-*` owner decisions it builds on are likewise unanchored. Verified
2026-09-27 by repo-wide grep: `MODULDOSSIER`, `G04`, `G07` and `OE-2609` produce
**zero** hits in `AGENTS.md`, `docs/`, `missions/` and `quality/`
(only hits are prior agent-memory files). `quality/authoritative-sources.json`
lists exactly seven truth types and does not include the dossier folder.

**Why:** D-GOV-001 assigns each truth type exactly one source. Requirements
arriving via dossier IDs (A-/K-/T-/Q-/S-/OE-) therefore have no governance
standing, even when a PL order calls the dossier "verbindlich". This has now
recurred for at least two packages (B1/G07 Storno, B2/G04 Auftrag-Zeitpunkte),
so it is a systematic gap, not a one-off oversight.

**How to apply:** Report this as a governance finding (missing anchoring) on every
dossier-driven package — never as a reason to re-invent the requirement, and never
silently "adopt" the dossier as authoritative. The dossier content is legitimate
source material; only its *authority* is missing. The fix is a docs PR that
registers the dossier or transcribes its decisions into the register — an
owner/PL decision, not a writer decision.

Related: [[reference-moduldossiers]], [[project-g04-b2-timestamps-storno]].
