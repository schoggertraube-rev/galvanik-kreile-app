# Review Q08 – Altkunde ohne Kundennummer

Geprüft: 27.10.2026 13:36 UTC · Branch kreile/s1-p2-eingang · Commit fdacd37a (Abgabe nennt Produkt-SHA f1a68edf)

Urteil: **PASS**

Geprüft:
- Migration 20261027140000_q8_assign_legacy_customer_number.sql: neue Datei, ersetzt nur private.update_customer_commercial_v1. Pflichtdaten (Name, Ansprechpartner, Telefon, E-Mail, Anschrift, Zahlungsbedingung) bleiben Pflicht. Kundennummer nur wenn NULL über allocate_customer_number, Zeile FOR UPDATE, idempotent über client_event_id. Grants nur service_role. Kein Löschen.
- customers.actions.ts: Readback verlangt zusätzlich Kundennummer.
- Kundenkarte "Neuer Auftrag" -> GlobalCreateFlow mit prefill.customerId, Kunde EXISTING vorausgewählt; kein zweiter Neukunden-Schreibweg.
- Nachweis: Sabrina Schmidt K-2026-0011, Auftrag A-2026-0007 (Prüfer-Notiz 14:05: 2 Aufträge).
- DB: Remote 46 = Repo 46, 20261027140000 eingespielt.
