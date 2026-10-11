---
name: project-b1-storno-p0
description: Package B1 P0-Storno closes K-G07-004 on the DB layer; it is the named LIVE = NO_GO blocker in the G07 dossier
metadata:
  type: project
---

Package B1 P0-Storno (branch `claude/kr-b1-storno-p0`) adds the DB-layer Storno payment gate to `private.guard_f1_4_invoice_update()` — rule K-G07-004, test obligation T-G07-016 in the G07 dossier.

**Why:** `_MODULDOSSIERS/G07_GELD_RECHNUNGEN/05_REGELN_SPERREN_KONFLIKTE.md` states `LIVE = NO_GO` for as long as K-G07-004 is not also closed at DB level **and really negative-tested**. Until B1 the check existed only in the app layer (`hasClearlyUnpaidPaymentState` in `src/lib/server/commands/immutableInvoiceCommand.ts`); anyone bypassing the command layer and setting only the session flag `app.invoice_cancel_command = 'v1'` could cancel a paid or inconsistent invoice.

**How to apply:** Treat the "real negative test" half as unfinished until a fresh-DB replay actually ran — a green typecheck/lint does not close this P0. K-G07-004 also has a second, still-open half: the "Rolf › Der Tag › Konflikte Geld" conflict projection (dossier status `FEHLT P0 (DB + Anzeige)`), so closing the DB gate alone does not close the conflict card. Related: [[feedback-integration-test-classification]].

**CI wiring of the guard test flip-flopped inside B1 (rounds 3-5, all on 2026-09-27).** Round 3 added the blocking step in `.github/workflows/quality.yml`; round 4 reverted it on Owner/PL instruction (B1 narrowed to migration + tests, workflow/ratchet churn deferred to a follow-up package); round 5 re-added it because the PR #114 review rated the PR FAIL with a P1 on exactly that gap ("Test im Fresh-Supabase-Replay verdrahten und am Exact-SHA erfolgreich ausfuehren"). Current B1 end state: the step IS wired, plus the `judgeContractHash` refresh in `quality/eslint-baseline.json`.

**Why:** Owner scope-trimming and reviewer evidence demands collided on the same artifact. The reviewer treats an unwired DB test as no proof at all for T-G07-016, so the narrow-scope version cannot pass review.

**How to apply:** Do not revert this step again on the strength of the round-4 scope decision alone — that instruction is superseded by the round-5 review finding. If a future instruction asks to remove it, surface the conflict instead of silently picking a side. The step must sit *after* the unpinned `supabase db reset --local --no-seed` in job `fresh-supabase-replay`: the earlier F1.4/F1.5 blocks are pinned to schema `20260909180000` and would not contain the new trigger. See [[ratchet-judge-contract-refresh]] for the mandatory hash refresh.
