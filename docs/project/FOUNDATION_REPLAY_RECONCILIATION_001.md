# FOUNDATION-REPLAY-RECONCILIATION-001

Stand: 2026-08-05  
Status: Draft-PR; kein Production-Write

## Ursache

Die historische Migrationskette war nicht von Null reproduzierbar:

- `0001_app_schema.sql` erzeugte `public.inquiries`.
- `0005_inquiries.sql` erzeugte dieselbe Relation erneut mit einem anderen Vertrag.
- Ein Fresh Replay brach deshalb in `0005` mit SQLSTATE `42P07` ab.
- Der Production-Ledger enthält beide Versionen als angewendet. Er ist damit kein Beweis, dass die eingecheckte Dateikette jemals sequenziell erfolgreich lief.

## Kanonischer Vertrag

`0005_inquiries.sql` ist die dedizierte Eigentümermigration für die Erzeugung von `public.inquiries`. Der versehentliche `inquiries`-Block wurde aus `0001_app_schema.sql` entfernt.

Diese historische Korrektur ist eine eng begrenzte Ausnahme vom Grundsatz, angewendete Migrationen nicht nachträglich zu ändern:

- keine Production-DDL oder -DML;
- keine Änderung am Production-Ledger;
- keine Änderung an bestehenden Produktionsdaten;
- die ursprünglichen Production-Statements bleiben im realen Supabase-Ledger und im Ledger-Manifest nachvollziehbar;
- keine andere historische Migration wird verändert.

## Dauerhaftes Gate

Der Workflow `.github/workflows/quality.yml` startet für jeden PR eine isolierte lokale Supabase-Instanz und führt anschließend `supabase db reset --local` aus.

Ein PR darf nicht als bestanden gelten, solange nicht alle Migrationen von Null durchlaufen. Der Fix für den ersten Fehler ist kein Beleg, dass keine weiteren historischen Replay-Fehler existieren.

## Abgrenzung

Die uncommitteten Dateien der Mission `SECURITY-RECONCILIATION-001` sind nicht Bestandteil dieses Replay-Fixes. Sie werden erst auf einer vom erfolgreich geprüften Fundament abgeleiteten Mission fortgeführt.
