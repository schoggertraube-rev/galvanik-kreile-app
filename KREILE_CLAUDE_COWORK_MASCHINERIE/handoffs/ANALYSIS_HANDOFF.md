# ANALYSIS HANDOFF — Fundament-Audit WerkstattCockpit

**Von:** Chefdirigent (+ Fachprüferboard Data/Security/Performance + QA-Gates)
**An:** Auftraggeber · nachfolgende Bauleitung (Welle 0 ff.)
**Datum:** 2026-07-05 · **Prüf-HEAD:** `204f3f105824ea098f2d71f72489dc1bd0de85e3` · **Branch:** `feature/capture-auth-tenant`

- **Scope:** Vollständiger Fundament-Audit (02_app): Fehler, Mocks, Logik-/Vernetzungsfehler; Wiederverwendbarkeit (Evas Lerninsel); Reparaturleitfaden; REDTEAM/TRUTH; Abgleich User Twins + Ideen. Analyse-Mission (kein Bau; aktives Gate REJECTED_FOR_REVISION beachtet).
- **Quellen:** `src/` (613 Dateien), `supabase/migrations/` (80+), Drizzle-Schema, `.env.local`, 5 Ideenkataloge (4.385 Z.), 3 User Twins, USP-Doku, autoritative Projektdokumente, QA-Gate-Läufe.
- **Fakten:** 15/18 API-Routen ohne Auth; `app.tenant_id` nie gesetzt; App als Superuser (BYPASSRLS); kein FORCE RLS; PIN Klartext; `orders.current_station_id` + `events` nie migriert; 9 Mock-Repos; 4 Offline-Systeme; base64 im localStorage; 136 Tenant-Hardcodes/47 Dateien; 647-Datei-`.agents/`-Klon im Scan-Scope; Register leer; Gates grün (tsc0/Unit75/Build77).
- **Annahmen:** Storage-Buckets ggf. manuell public gestellt (H); Konfidenzschwellen unkalibriert (H); UX-Detailflows nur teilgeprüft (Fachprüfer am Sessionlimit ausgefallen).
- **Findings:** 41 Befunde + 8 Positivbelege → `registers/FINDINGS_REGISTER.md` (F-A1…F-H3, P-1…P-8).
- **Root Causes:** (A) Tenant/RLS nur auf Papier; (B) Schema nicht reproduzierbar; (C) zwei Datenpfade + Mock = Vernetzungsursache; (D) Ereignismodell blockiert Slice 1; (F) Governance/Register leer.
- **offene Fragen:** Branch-Integration nach main? Remote-Schema-Dump als Baseline? Pilot-Mandant für Livegang?
- **Vertragsauswirkungen:** Verstöße gegen Slice-Regeln 1,2,3,4,6,13,16,17; V1-Korrekturen 8/9 offen; Kernregel 16 formal erfüllt, real wirkungslos.
- **Risiken:** R-01…R-11 → `registers/RISK_REGISTER.md` (Top: grüner-Build-Trugschluss, DSGVO-Abfluss, Schema-Drift-Datenverlust, Wiederverwendungs-Blockade).
- **Empfehlung:** Sanieren-in-place in 6 Wellen; Bau-Stopp bis Welle 0–2 abgenommen; Evas-Template erst nach Welle 3.
- **benötigte Spezialisten:** Welle 0 Security+Build; Welle 1 Data Contract; Welle 2 Platform+Data; Welle 3 Security+Data; Welle 4 Performance+Data; je unabhängiger QA/E2E-Verifier.
- **nächster Gate:** Auftraggeber-Freigabe des Sanierungspfads → `BUILD_HANDOFF` Welle 0.

## Lieferobjekt (Bibel)

- **Ordner:** `KREILE_PROJEKT_DOKUMENTATION/10_FUNDAMENT_BIBEL_2026-07-05/` (9 Kapitel + Register-Snapshot + Rohdaten)
- **ZIP:** `KREILE_PROJEKT_DOKUMENTATION/KREILE_FUNDAMENT_BIBEL_2026-07-05.zip`
- **Größe:** 82.697 Bytes · **SHA256:** `653070898AECFC0D147644FEF4009112A806AC41F8FBA5E45C2D6E117045B9F0`

## Verifikationsstatus

- 15/15 CRITICAL/HIGH-Kernbefunde vom Chefdirigenten direkt reproduziert (KONDUKTOR-VERIFIZIERT, EVIDENCE_LEDGER E-01…E-25).
- REDTEAM-Subagenten am Sessionlimit ausgefallen → durch reproduzierbare Direktprüfung ersetzt (Board-Entscheidung 02).
- Kein Laufzeit-E2E-Beweis erbracht — bleibt Pflicht der Reparatur-Wellen (Gates G1–G11, Kapitel 07).

## Hinweis Governance vs. Automatik-Hook

Register-/Berichtsdateien sind **bewusst nicht committet**. Governance-Regel 8 verlangt Missionsfreigabe vor Commit/Merge/Push; ein Automatik-Hook forderte einen Commit — hier hat Governance Vorrang. Commit erfolgt erst nach ausdrücklicher Freigabe.
