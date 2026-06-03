# F-BH-09B Supabase Migration Protokoll

**Datum:** 2026-06-03
**Git HEAD:** 0f56f5d
**Supabase Project Ref:** syhaigjhsbpjmtnggqka (galvanik-kreile-werkstatt, Frankfurt)

## Ausführung
- **Migration ausgeführt:** Ja (Manuell)
- **Ausführungsweg:** Dashboard / CLI durch Nutzer
- **PostgREST Reload:** Bestätigt (`pg_notify('pgrst','reload schema')`)

## Ergebnisse der Prüfungen
- **Tabellenprüfung:** Erfolgreich. Alle 12 Buchhaltungs-Tabellen (beleg, beleg_position, kraftstoff_detail, ausgangsrechnung, zahlung, kategorie, lieferant, steuerprofil, ustva_periode, export_lauf, bh_audit_log, bh_einstellungen) sind im `public`-Schema vorhanden.
- **Spaltenprüfung:** Erfolgreich für `beleg`, `bh_audit_log`, `export_lauf`, `ustva_periode`.
- **Triggerprüfung:** Erfolgreich. GoBD-Trigger (`trg_beleg_gobd`, `trg_beleg_no_delete`, `trg_audit_no_update`, `trg_audit_no_delete`) und Audit-Trigger (`trg_beleg_audit_insert`) sind korrekt installiert.
- **Policyprüfung:** Erfolgreich. 13 Policies aktiv (alle Tabellen `PERMISSIVE` für `authenticated`), für `bh_audit_log` streng nach `INSERT` und `SELECT` getrennt.
- **Storage-Bucket:** Erfolgreich. Bucket `buchhaltung-belege` existiert und ist `public: false` (privat).
- **GoBD-Minimaltest:** (Aufgrund Remote-Produktivsystem und Mock-Status in der App derzeit nicht per E2E ausführbar, aber Trigger-Level verifiziert).

## Offene Punkte
- Die App befindet sich noch im Mock-Modus.
- Die Integration (Provider Umschaltung) und das Upload-Handling für den Storage-Bucket (via Signed URLs) stehen in den nächsten Tasks (F-BH-10) an.
