# F0 CLOSEOUT — Fundament-Abschlusserklaerung (Neufassung 2026-08-10)

**Status: FAIL_INTERNAL** (Statuskorrektur 2026-08-10; Details/Norm: F0_FINAL_REPORT.md,
F0_HANDOFF.json, F0_CONTRACT_V1.md, F0_DEFECT_REGISTER.md). ZIP_READINESS: RED. Externe Ratifikation:
PENDING_EXTERNAL. Diese Fassung ersetzt die vom 07.08. vollstaendig (BF-005: dort stand die
Ledger-Reconciliation noch als spaetere Aufgabe).

F0 ist NICHT abgeschlossen; naechstes Paket F0-W2 Quarantaene (siehe Uebergabe,
KREILE_F0_UEBERGABE_UND_F1_START.md).

## Erfuellt (Belege = aktive CI-Gates + Live-Zustand, s. F0_TEST_EVIDENCE.md)
- DB-Wahrheit: Baseline-Replay x2 deterministisch; 7 harte Fingerprint-Komponenten = Prod;
  Ledger 9/9 RECONCILED (08.08.: 98→8; 10.08.: +Normalisierungsmigration; Digest 268ce6c1…).
- Security/Storage: 0 anon/auth-Grants relationsweit; 29 RLS-Policies + 8-Tabellen-Fixture-Matrix;
  17/17 Views invoker (+ hartes viewopts-Gate); echte Storage-HTTP- (S1–S12) und Session-Ketten-
  Beweise (V1–V5) im CI.
- Modulare Grenze: kanonische Clients, Boundary-Gate, Manifest-Schema (minimal, kein Baukasten-Claim).
- Dokumentwahrheit: kanonische Dateien 10.08. neu geschrieben, doc-truth-CI-Gate aktiv.

## Deklarierte Ausnahme (extern)
def_privs FOR ROLE supabase_admin: BLOCKED_EXTERNAL_PERMISSION (15/24 defacl; 42501-Evidenz;
Kompensation aktiv; Ticket-Vorlage im F0_PERMISSION_PACKET.md).

## Nicht Teil von F0 (Betreiber/Go-live/F1)
DB-Passwort-Rotation · Leaked-Password-Protection AKTIVIEREN (Pflicht vor Go-live) ·
Backup-/Restore-DRILL (Rollback vorbereitet, nicht getestet) · 48h-Offline · Rate-Limit-Wirkungs-
Drill · UI-Gesamtabnahme · E2E-Kernweg · Module/Baukasten (F1 gem. Masterplan) · pg_trgm-Umzug.
