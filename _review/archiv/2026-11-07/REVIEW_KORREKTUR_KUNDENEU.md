# Review Korrektur Kunde anlegen 01/02 (Prüfer Claude, 28.10.2026 01:27 UTC)

Branch `kreile/s1-p2-eingang`, Commits f604b114 (01), cc23cf8c (02). Erste Prüfung.

## Urteil

- **Kunde-01: PASS.** Eine gemeinsame `CustomerFormFields`-Komponente für eigenständige Anlage und Neuen Eingang (ein Schreibweg). Kundentyp ohne Vorbelegung (Gewerbe/Privat), „Rechnung auf Ziel“ nicht wählbar, Dublettenprüfung, Abbrechen-Rückfrage. „Als Interessent speichern“ mit wenigen Feldern ist zulässig, weil der Auftrag weiterhin vollständige Pflichtdaten verlangt (Server-Guard `resolveCustomer`).
- **Kunde-02: PASS.** Notiz im atomaren Anlage-Vertrag (eine Transaktion); `enableCustomerInvoiceTermsCommand` verlangt Kundenrecht + `geld`; Migration additiv (neue Spalten + private Funktion, kein DELETE).

## Hinweise (nicht Blocker, in DEZEMBER_LISTE)

- Migration 20261028010000 ändert Bestandsdaten (`institution` → `business`; laut Nachweis 0 Zeilen betroffen).
- `updateCustomerCommercialCommand.ts`: neue Fehlermeldungen mit kaputter Kodierung („verfÃ¼gbar“, „dÃ¼rfen“, „Ã¤ndern“) – sichtbar für Nutzer.

DB: Remote 54 = Repo 54. Synchron.
