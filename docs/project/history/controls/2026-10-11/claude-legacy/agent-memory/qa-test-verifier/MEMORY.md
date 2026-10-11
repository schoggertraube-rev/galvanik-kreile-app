# Memory Index

- [Bibel/Repo-Divergenz bei Governance-Dateien](project_bibel_repo_divergence.md) — Master in 00_BIBEL darf vor der Repokopie liegen; Hash-Abweichung ist Nacharbeit, kein FAIL.
- [G07-Dossier ist nicht D-GOV-001-autoritativ](project_g07_dossier_not_authoritative.md) — K-G07-*/T-G07-* haben keine Governance-Verankerung; Mission nennt anderes aktives Paket.
- [B1-Storno CI-Wiring pendelt](project_b1_storno_ci_wiring_oscillation.md) — Runde 3 rein, Runde 4 per Owner raus, Runde 5 wieder verlangt; seit 0d3bacc6 committet, Owner-Veto nie zurueckgezogen.
- [lint:ratchet haengt an quality.yml](project_ratchet_judge_contract_couples_quality_yml.md) — jede Byte-Aenderung bricht den judge-contract; Fix nur per Baseline-Refresh.
- [next/font-Turbopack-Build ist flaky](project_turbopack_next_font_flaky_build.md) — gleiche Quelle mal gruen mal rot; ein gruener Build widerlegt keinen ROT-Bericht.
- [Runner-ROT-Berichte koennen veraltet sein](project_runner_report_staleness.md) — Bericht vs. gruener Lauf: Cache umgehen und mtimes/Zeilennummern gegenpruefen.
- [W4-Gate ohne lokales Signal](project_w4_gate_no_local_signal.md) — laeuft nur in quality.yml, nicht in verify:precommit; erklaert wiederkehrende "view missing from inventory"-Befunde.
- [F0-Review-Manifest: veraltete Hash-Pins, unverdrahtet](project_f0_review_manifest_stale_unwired.md) — W4-EVID-STALE-001 ist Nacharbeit, nicht FAIL; Unverdrahtetheit trotzdem jedes Mal nachpruefen.
- [Paketergebnisse liegen oft nur im Worktree](project_package_deliverables_arrive_uncommitted.md) — Commit-/Push-Stand und Diff gegen HEAD zuerst pruefen, sonst PROPOSED_PASS statt PASS.
- [B2 ist auf ungemergtes B1 gestapelt](project_b2_stacked_on_unmerged_b1.md) — main...HEAD enthaelt B1-Migration 20260926120000; B2-Merge merged B1 mit.
- [B2-TZ-Artefakt ist erledigt](project_b2_fixture_timezone_artifact.md) — seit Z-Suffix-Fix beide Zonen 16/16 gruen; alter "nur TZ=UTC fahren"-Merksatz ist jetzt falsch.
- [Manifest-Feld `migrations` ist nicht gate-gelesen](project_manifest_migrations_field_not_gate_read.md) — rein dokumentarisch, aber werkstatt.manifest.json ist KEINE Praezedenz fuer eine unvollstaendige Liste.
- [Q-G04-008 ist NICHT ratifiziert](project_q_g04_008_not_ratified.md) — Auftraege behaupten "PL-ratifiziert Option B"; Dossier sagt OFFEN mit fachlicher Neigung zu A.
- [Ablage der MODULDOSSIERS](reference_moduldossiers.md) — Wo die A-/K-/T-/Q-IDs je Modul stehen und welche Datei welche Wahrheit traegt.
