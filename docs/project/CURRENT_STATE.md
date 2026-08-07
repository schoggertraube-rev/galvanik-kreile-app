# Current State

Stand: 2026-08-06 - verifizierter Ist-Stand gegen `origin/main`, Supabase Production und Vercel.

Diese Datei ersetzt den veralteten Stand vom 2026-08-05, der Data-API und PIN faelschlich als offen fuehrte. Ein gruener Build oder ein aktuelles Deployment ist kein Gesamt-PASS.

## Gesamturteil

| Ebene | Status | Verifizierter Stand |
|---|---|---|
| GitHub-Lieferquelle | `PASS` | `main` ist einzige Lieferwahrheit; Head `6e0c74893ed10e5337e03b10457477f4b6d8cbf7`. |
| Vercel Production | `PASS_CURRENT_MAIN` | Production laeuft auf aktuellem `main`. |
| Data-API-Sicherheit (Production) | `DONE_VERIFIED` | 2026-08-05 alle Tabellen-Grants fuer `anon`/`authenticated` entzogen; per SQL 0 verbleibende Grants verifiziert. |
| PIN-Bestand (Production) | `DONE_VERIFIED` | 6/6 App-User bcrypt cost 12; 0 Legacy-Klartext-PINs (per SQL verifiziert). |
| Storage-Buckets (Production) | `DONE_VERIFIED` | `belege` 2026-08-06 auf privat gesetzt (D1); `buchhaltung-belege`, `item-photos`, `scans` bereits privat. |
| Public-Funktions-Grants (Production) | `DONE_VERIFIED` | 2026-08-06 EXECUTE fuer 9 App-Funktionen von `PUBLIC`/`anon`/`authenticated` entzogen (D2); `service_role`/`postgres` behalten Zugriff. |
| Tenant-Datenbestand (Production) | `CLEARED` | 2026-08-06 auf ausdrueckliche Freigabe alle Geschaeftsdaten (orders, customers, items, events, scan_uploads + abhaengige Tabellen) geloescht; 6 `app_users` erhalten. |
| Migrationswahrheit auf `main` | `FAIL` | Mehrere Production-Aenderungen (Data-API-Revoke, Default-Privileges, PIN-bcrypt, D1, D2) wurden per `execute_sql` angewandt und liegen ausserhalb des Ledgers. Fresh-Replay bleibt unbewiesen. |
| Operativer E2E-Kern | `NOT_PROVEN` | Kunde -> Auftrag -> Behaelter/QR -> Teil -> Aktion -> Today -> Beleg -> Reload wurde nie durchgaengig ausgefuehrt oder durch einen automatisierten Test abgesichert. |
| Offline-Vertrag | `CONTAINED_ONLY` | Kein echter, verifizierter Sync-Transport. Datenverlust-Pfad in SyncContext ist stillgelegt (PR #42, offen). 48h-Nachweis fehlt. |
| Produkt-Go-live | `NO_GO` | E2E-Kern, Offline-Vertrag, RLS-Relationsmatrix, Fresh-Replay und Ledger-Konsolidierung sind nicht abgenommen. |

## Fundament-Fixes: Stand F0-Konsolidierung

C1 (`#42`) ist nach `main` gemergt (`62af22d7`). Die uebrigen Fixes sind im F0-Konsolidierungskandidaten
`#48` (Branch `f0/consolidation`) gebuendelt; Merge erfolgt gebuendelt nach Freigabe.

| PR | Inhalt | Status |
|---|---|---|
| `#42` | C1 - SyncContext: stiller Datenverlust gestoppt. | **INTEGRATED (main)** |
| `#43` | C2 - `inquiriesRepository` auf Server Action; kein Fake-Success. Fail-closed Auth + B1-Negativtests. | INTEGRATED in `#48` |
| `#44` | C3+C4 - Today-Datenvertrag server-seitig; Mock-Typen raus. + B2. | INTEGRATED in `#48` |
| `#45` | G1 - diese wahrheitsgetreue Doku (additiv). | INTEGRATED in `#48` |
| `#46` | B4 - Upload-Routen autorisiert + Signed URLs + Negativtests. | INTEGRATED in `#48` |
| `#41` | Docs + Offline-Containment. | **SUPERSEDED** - kuerzt geschuetzte Anforderungen; Doku-Teil durch `#45` ersetzt. Nicht mergen. |
| `#40` / `#47` | Baseline-Ersatz (Draft) / D1-D2-Migrationen. | MATERIAL fuer F0-03/04 (Ledger/Replay). |

## Angewandte Production-Aenderungen ausserhalb des Ledgers (APPLIED_NOT_IN_LEDGER)

Diese Aenderungen sind produktiv wirksam, aber nicht als Migration im Ledger abgebildet. Vor Go-live in eine ledgerfaehige, replaybare Form ueberfuehren.

- 2026-08-05: Data-API-Grant-Entzug auf allen Tabellen/Views fuer `anon`/`authenticated` (0 Grants verifiziert).
- 2026-08-05: Default-Privileges fail-closed fuer kuenftige `public`-Objekte von `postgres`.
- 2026-08-05: PIN-Bestandsmigration auf bcrypt cost 12 (6/6).
- 2026-08-06: D1 - Bucket `belege` auf privat.
- 2026-08-06: D2 - EXECUTE-Entzug fuer `fn_compute_warnings`, `fn_is_production_order`, `fn_update_vorlagen`, `fn_verteile_energiekosten`, `search_global`, `log_beleg_insert`, `prevent_beleg_delete`, `prevent_beleg_mutation`, `prevent_audit_mutation`.
- 2026-08-06: Loeschung aller Tenant-Geschaeftsdaten (ausdrueckliche Freigabe).

## Noch offen / nicht behauptet

| ID | Status | Restarbeit |
|---|---|---|
| `SUPABASE-ADMIN-DEFAULTPRIV-001` | `BLOCKED_EXTERNAL` | Default Privileges von `supabase_admin` fuer `anon`/`authenticated` bestehen weiter; nur ueber Dashboard/Owner loesbar. |
| `LEDGER-CONSOLIDATION-001` | `ACTIVE` | Die per `execute_sql` angewandten Aenderungen ledgerfaehig nachziehen; Fresh-Replay herstellen. |
| `RLS-CONTRACT-001` | `ACTIVE` | Relationenspezifische Rollen-/Tenant-Matrix; tenant_isolation greift architektonisch noch nicht sauber. RLS ist nicht entfallen. |
| `OPERATIVE-SLICE-001` | `NOT_PROVEN` | E2E-Kernweg durchgaengig ausfuehren und automatisiert absichern. CI-E2E prueft aktuell nur zwei Auth-Faelle. |
| `OFFLINE-SHELL-001` / `OFFLINE-48H-001` | `BLOCKED` | Echter Sync-Transport, Outbox-Idempotenz, Konflikte, Restart und 48h-Nachweis fehlen. |
| `SEC-STORAGE-BELEGE-001` | `READY` | `belege`-Anzeige/Download auf serverseitige Signed URLs umstellen (Bucket ist jetzt privat). |
| `SEC-PIN-002B` | `PARTIAL` | Device-Binding/Challenge bleibt Produktentscheidung; Leaked-Password-Schutz vor Go-live im Dashboard aktivieren. |
| `SYSTEMATIC-AUDIT-001` | `OPEN` | Nur die vom Review benannten Dateien wurden verifiziert; weitere Client-Supabase-Pfade und Rechnungs-/Reklamations-/Upload-Pfade sind nicht systematisch geprueft. |

## Naechste Reihenfolge

1. Diese Doku-Korrektur pruefen lassen; bei Bedarf korrigieren.
2. Sammelfreigabe fuer PR #42/#43/#44; #41 schliessen oder auf Doku-Korrektur reduzieren.
3. Ledger-Konsolidierung + Fresh-Replay.
4. Automatisierter E2E-Kernweg-Test; danach Offline-Vertrag.

## Freigabegrenzen

Ohne ausdrueckliche Freigabe erfolgen weiterhin kein Merge, kein Production-Deploy, keine weitere Remote-Migration, keine RLS-/Policy-Aenderung und keine weitere Datenloeschung. Der Dirty-Worktree `feature/capture-auth-tenant` wird nicht angetastet.
