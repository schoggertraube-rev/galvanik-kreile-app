---
name: feedback-scope-stop-and-report
description: Validated pattern — when a green-lit narrow fix reveals an adjacent defect, stop at the scope boundary and report it as a named finding instead of fixing it; the coordinator then authorizes it explicitly
metadata:
  type: feedback
---

When a narrowly authorized fix ("behebe genau diese drei Compile-Fehler, sonst NICHTS") uncovers a further defect — even in a file that is already on the allowlist, and even when the fix would *strengthen* tests rather than weaken them — do not fix it. Report it as a numbered finding with its own ID, prove it is pre-existing and not caused by your change, recommend the follow-up, and close `FAIL_INTERNAL` if a required check is red.

**Why:** Confirmed by the chief-conductor in the B2/G04 round (2026-09-27): a `FAIL_INTERNAL` report naming `B2-R1-F04`/`F05` was answered with "Danke fuer den sauberen FAIL_INTERNAL-Bericht ... Ich autorisiere jetzt genau das von dir empfohlene enge Folgepaket", including the exact edit list. Stopping produced a faster, cleaner authorization than silently widening scope would have. It also keeps the writer/reviewer split intact (AGENTS.md: Pruefer ≠ Autor, "Nimm dich nicht selbst ab").

**How to apply:** Two extra duties make the stop credible: (a) prove the adjacent defect predates your edit by reasoning from the code (e.g. a fail-closed `throw` that every fixture would have hit), and show your change strictly improved the counts; (b) never report a green suite as package PASS — the authorized-scope result can be PASS, but package abnahme belongs to the independent reviewer. Also state what you did NOT verify (e.g. no real DB → `NOT_RUN`, per [[feedback-integration-test-classification]]). Related: [[feedback-output-contract]].
