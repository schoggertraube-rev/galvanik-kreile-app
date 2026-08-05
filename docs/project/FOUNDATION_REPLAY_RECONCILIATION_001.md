# FOUNDATION-REPLAY-RECONCILIATION-001

Stand: 2026-08-05  
Status: Draft-PR; kein Production-Write

## Ursache

Die historische Migrationskette war nicht von Null reproduzierbar:

- `0001_app_schema.sql` erzeugt den ersten, später abzulösenden Vertrag von `public.inquiries`.
- `0002_rls_policies.sql` setzt Policies auf diese Legacy-Tabelle und benötigt sie deshalb.
- `0005_inquiries.sql` versuchte dieselbe Relation erneut unbedingt zu erzeugen.
- Der Fresh Replay brach deshalb ursprünglich in `0005` mit SQLSTATE `42P07` ab.
- Der Production-Ledger enthält beide Versionen als angewendet. Er beweist nicht, dass die eingecheckte Dateikette jemals sequenziell erfolgreich lief.

## Kanonischer Ablauf

`0001` erzeugt die Legacy-Tabelle, damit `0002` ausführbar bleibt. `0005` entfernt diese zu diesem Zeitpunkt noch unbesiedelte Tabelle und erzeugt anschließend den neuen, kanonischen Vertrag.

Die Korrektur liegt damit in der Migration, die den Vertragswechsel ohnehin beansprucht. `0001` bleibt unverändert.

Diese historische Korrektur ist eine eng begrenzte Ausnahme vom Grundsatz, angewendete Migrationen nicht nachträglich zu ändern:

- keine Production-DDL oder -DML;
- keine Änderung am Production-Ledger;
- keine Änderung an bestehenden Produktionsdaten;
- Production führt `0005` nicht erneut aus, weil die Version dort bereits als angewendet registriert ist;
- die ursprünglichen Production-Statements bleiben im realen Supabase-Ledger und im Ledger-Manifest nachvollziehbar;
- keine andere historische Migration wird verändert.

## Dauerhaftes Gate

Der Workflow `.github/workflows/quality.yml` startet für jeden PR eine isolierte lokale Supabase-Instanz und führt anschließend `supabase db reset --local` aus.

Ein PR darf nicht als bestanden gelten, solange nicht alle Migrationen von Null durchlaufen. Der Fix für den ersten Fehler ist kein Beleg, dass keine weiteren historischen Replay-Fehler existieren.

## Abgrenzung

Die uncommitteten Dateien der Mission `SECURITY-RECONCILIATION-001` sind nicht Bestandteil dieses Replay-Fixes. Sie werden erst auf einer vom erfolgreich geprüften Fundament abgeleiteten Mission fortgeführt.
