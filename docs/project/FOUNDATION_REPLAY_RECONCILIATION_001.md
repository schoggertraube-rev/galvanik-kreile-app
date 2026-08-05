# FOUNDATION-REPLAY-RECONCILIATION-001

Stand: 2026-08-05
Status: `BASELINE_REQUIRED`; Draft-PR; kein Production-Write

## Verifizierter Befund

Die historische Migrationskette ist nicht von Null reproduzierbar:

1. `0001_app_schema.sql` erzeugt `public.inquiries`.
2. `0005_inquiries.sql` erzeugt dieselbe Relation erneut und bricht mit SQLSTATE `42P07` ab.
3. Entfernt man die Legacy-Tabelle aus `0001`, scheitert `0002_rls_policies.sql`, weil es bereits Policies auf `inquiries` anlegt.
4. Ersetzt `0005` die Legacy-Tabelle, kollidiert dessen `customer_id text` mit `customers.id uuid`.
5. Weitere frühe Brüche sind statisch belegt:
   - `0009_items.sql` setzt einen neuen Tabellenvertrag auf eine bereits anders angelegte `items`-Tabelle.
   - `0011_complaints.sql` tut dasselbe für `complaints`.
   - `0012_harden_rls.sql` referenziert `events`, obwohl die frühe Kette nur `status_events` erzeugt.
   - `202605290002_schema_contract_sync.sql` ändert die inkompatiblen ID-Typen nicht.

Der Production-Ledger enthält die Versionen trotzdem als angewendet. Er ist deshalb kein Beweis für einen erfolgreichen sequenziellen Replay.

## Entscheidung

Keine Serie historischer Einzelpatches. Sie könnte den Replay syntaktisch grün machen, ohne den aktuellen Production-Vertrag zu reproduzieren.

Die kanonische Reparatur ist eine neue, geprüfte Baseline aus dem aktuellen Production-Schema:

- schema-only, keine Nutzdaten;
- historischer Bestand unverändert und außerhalb der aktiven Replay-Kette archiviert;
- Baseline auf einer leeren lokalen Supabase-Instanz ausführbar;
- anschließender Schema-Paritätsvergleich gegen Production;
- erst danach Fortsetzung der Security-Reconciliation;
- Production-Ledger-Abgleich in einer separaten, ausdrücklich freigegebenen Release-Mission.

## Dauerhaftes Gate

Der Workflow `.github/workflows/quality.yml` startet für jeden PR eine isolierte lokale Postgres-Instanz und führt `supabase db reset --local` aus.

Das Gate bleibt rot, bis eine valide Baseline die historische Kette ersetzt. Es darf nicht durch Überspringen von Migrationen oder ein gefälschtes Ledger grün gemacht werden.

## Abgrenzung

Die uncommitteten Dateien der Mission `SECURITY-RECONCILIATION-001` sind nicht Bestandteil dieser Diagnose. Sie bleiben bis zum erfolgreichen Baseline-Replay uncommitted und dürfen nicht in Production ausgeführt werden.
