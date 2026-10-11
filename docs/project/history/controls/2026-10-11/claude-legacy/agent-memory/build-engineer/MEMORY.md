# Memory Index

- [Integration-Test-Klassifikation](feedback_integration_test_classification.md) — Guards nie abschwaechen; ohne DB NOT_RUN; TZ-feste Fixture-Bindung; Ledger luegt, `pg_get_viewdef` pruefen; Negativkontrolle fuer View-Fixes.
- [Paket B1 P0-Storno](project_b1_storno_p0.md) — K-G07-004 auf DB-Ebene; benannter `LIVE = NO_GO`-Blocker im G07-Dossier.
- [Ratchet-Judge-Contract](feedback_ratchet_judge_contract_refresh.md) — Workflow-Edit erzwingt Baseline-Refresh; Diff nur judgeContractHash, sonst BLOCKED.
- [Outputvertrag](feedback_output_contract.md) — Stop-Hook prueft 12 Pflichtteile; Registeraenderungen, Handoff und Abschluss-Enum werden am haeufigsten vergessen.
- [F0-Review-Manifest eingefroren](project_f0_review_manifest_frozen.md) — gepinnte F0-Hashes sind stale und nirgends verdrahtet; lebende W4-Pruefung ist das read-ports-Skript.
- [Ablage von Real-DB-Tests](feedback_integration_test_placement.md) — Integrationstests nur in `src/test/*.integration.test.ts`; im Modulordner sind Naht 2/4 zwingend rot.
- [Scope-Stop statt Selbstausweitung](feedback_scope_stop_and_report.md) — Nachbarbefund als ID melden statt fixen; vom Conductor ausdruecklich bestaetigt.
- [W4-Relationsnamen im Klartext](feedback_w4_relation_names_plaintext.md) — Gate matcht Volltext inkl. JSDoc; Auto-Discovery nur `private.v_*`, `public.v_*` Opt-in, PASS dort kein Beweis.
- [npx/npm permission-gesperrt](feedback_npx_permission_blocked.md) — bei "requires approval" keine Umgehung; Checks NOT_RUN an Conductor, kein PASS.
- [Build-Artefakt-Experimente](feedback_build_artifact_experiments.md) — keine `.next`-Geschwisterkopien: Guard blockiert `rm -rf`, Temp-Dir statt Repo nutzen.
