---
name: feedback-output-contract
description: Every build-engineer final report is checked by a stop hook against a 12-part output contract; missing Registeraenderungen, Handoff or the closing status enum blocks the turn
metadata:
  type: feedback
---

Final reports are validated by a stop hook ("Pruefe den Outputvertrag des Subagenten"). It blocks with `{"ok": false, "reason": "..."}` when a mandatory part is missing. Deliver **all twelve**, each as its own labelled section:

1. Scope (what was authorized — and that nothing beyond it was touched)
2. Gelesene Quellen (absolute paths)
3. Fakten
4. Annahmen
5. Findings **mit IDs** (invent stable IDs, e.g. `B2-R1-F04`; keep them across rounds so the coordinator can authorize per-ID)
6. Root Causes
7. Vertraege und Konsumenten (which contract changed, all consumers checked)
8. Risiken
9. Empfehlungen
10. Nicht geprüfte Bereiche (explicitly incl. what was NOT run: real DB, E2E, module gates, build, preview)
11. **Registeraenderungen** — most-forgotten part. Name `docs/project/CURRENT_STATE.md`, `docs/project/NON_LOSS_REGISTER.md`, `docs/project/DOCUMENT_AUTHORITY.md` / `quality/authoritative-sources.json`, `missions/F1_ORDER_TO_CASH_PILOT_001.yml`, `quality/module-gates-baseline.json` — and state for each whether it changed, must change later, or has no change need. "None" is a valid answer but must be stated and justified, never omitted.
12. **Handoff** — to whom, which files, which branch/PR, next mission/gate, and what still blocks handover.

Close with the enum verbatim as a set status: `PASS` | `FAIL_INTERNAL` | `BLOCKED_EXTERNAL_PERMISSION` | `BLOCKED_PRODUCT_DECISION`. Merely using the word in prose is rejected — write `STATUS: <enum>` with a justification.

**Why:** The hook is an automated gate, not a style preference; a missing section costs a full extra round trip. Registeraenderungen and Handoff exist because governance truth (AGENTS.md D-GOV-001) is spread across register files that a code-only report silently leaves stale.

**How to apply:** Draft the report against this list before sending, even for a three-line fix. Related: [[feedback-scope-stop-and-report]], [[feedback-integration-test-classification]].
