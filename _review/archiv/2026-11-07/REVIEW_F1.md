# Review F1 · Neuer Eingang

Geprüft: 27.10.2026 19:27 UTC · Branch kreile/s1-p2-eingang · Commit 0c6b5407 · Preview dd5manta9 (Kopf 7af94e99) READY

## Urteil: **PASS** (keine Blocker) – Owner-Klickweg 1–6 laut Regel 4d offen

Geprüft:
- Pflichtdaten Neukunde: `orderIntakeCommand.ts` normalizeNewCustomer verlangt Name, Ansprechpartner, Telefon, E-Mail, Straße/PLZ/Ort/Land, Zahlungsbedingung (Regex). Bestandskunde: Vollständigkeitsprüfung (contact_person, email, phone, Anschrift, payment_preference) unverändert.
- Ein Neukunden-Schreibweg: Intake nutzt dieselbe `private.create_customer_v1` in derselben Transaktion wie der Auftrag → kein verwaister Kunde. Recht `perm_data_customers` zusätzlich geprüft.
- Migration 20261027193000 additiv (private-Tabelle, nur service_role), remote angewandt.
- Keine Hex-Farben (nur var(--…)), keine verbotenen Pfade.

Nicht-Blocker → DEZEMBER_LISTE.
