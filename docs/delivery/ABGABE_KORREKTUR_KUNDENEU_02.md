# Abgabe Korrektur Kunde anlegen 02

## Befund

> „Notiz nicht im Anlage-Vertrag (K9); ‚Rechnung auf Ziel‘ setzbar ohne Recht geld und ohne eigenen Freischalt-Command (K8).“

Beleg aus dem Bauplan: `updateCustomerNoteCommand.ts:12; updateCustomerCommercialCommand.ts:24`.

Der offene Sicherheitsbefund aus `_review/REVIEW_KORREKTUR_EINGANG.md` ist in derselben Korrektur enthalten: Eine allgemeine Kundenänderung durfte die Zahlungsbedingung bislang ohne Bereich `geld` ändern und mit Geldrecht von Vorkasse auf Rechnung wechseln.

## Neu gemacht

- Die Notiz gehört jetzt zum `CreateCustomerInput`, zum Intent-Hash, zum unveränderlichen Anlage-Receipt und zum sicheren Readback. Dialog und Wiederanlauf verwenden denselben vollständigen Antrag (`src/components/layout/GlobalCreateFlow.tsx:1035`, `:1055`; `src/modules/customers/server/createCustomerCommand.ts:175`, `:221`).
- Kunde und Notiz werden in **einer** Datenbanktransaktion angelegt. Der bisherige nachgelagerte Notizaufruf ist aus dem Anlageweg entfernt (`supabase/migrations/20261028014500_customer_create_notes_and_invoice_terms.sql:31`).
- `updateCustomerCommercialCommand` liest die gespeicherte Zahlungsbedingung unter Sperre. Ohne Bereich `geld` ist jede Änderung verboten; ein leerer Bestandswert darf nicht still gesetzt werden. Auch mit Geldrecht ist jeder Wechsel in oder aus `rechnung_*` über diesen allgemeinen Weg gesperrt (`src/modules/customers/server/updateCustomerCommercialCommand.ts:43`, `:49`).
- Der eigene Command `enableCustomerInvoiceTermsCommand` verlangt Kundenrecht **und** Bereich `geld`, validiert 1–90 Zieltage sowie Skonto und schreibt idempotent über `private.enable_customer_invoice_terms_v1` (`src/modules/customers/server/enableCustomerInvoiceTermsCommand.ts:24`; Migration `:144`).
- Die Migration ergänzt die getrennten Felder `ziel_freigeschaltet`, `ziel_tage`, `skonto_prozent`, `skonto_tage` und erzwingt ihre Konsistenz. Sie verändert keine vorhandenen Kundendaten (`supabase/migrations/20261028014500_customer_create_notes_and_invoice_terms.sql:6`).
- Der Modulvertrag führt den neuen Command, die Migration, die Funktion und das Ereignis ausdrücklich.

## Datenbank-Nachweis

- Frischer lokaler Supabase-Replay aller Migrationen bis einschließlich `20261028014500`: **grün**.
- Lokaler realer Integrationslauf: **1 Datei / 5 Tests grün**. Die Anlage bestätigt genau einen Kunden, ein Ereignis und ein Receipt; `receipt.notes` und `customers.internal_notes` enthalten denselben Wert.
- Dev-Projekt `syhaigjhsbpjmtnggqka`: ausschließlich Migration `20261028014500_customer_create_notes_and_invoice_terms.sql` angewendet; anschließend sind lokale und entfernte Migrationsliste bis `20261028014500` identisch.
- Die Migration enthält keine Datenänderung bestehender Kunden. Erst der Owner-Klick erzeugt den ausdrücklich mit `TEST` benannten Nachweisdatensatz.

## Klickweg für den Owner

Preview nach Bereitstellung des Paket-SHA: `https://galvanik-kreile-werkstatt-iij4008sb.vercel.app` · Rolle Rolf.

1. **Anlegen → Kunde anlegen** öffnen. Bei Zahlungsbedingung dürfen weiterhin nur **Vorkasse** und **Bar oder Karte bei Abholung** erscheinen; **Rechnung auf Ziel** darf in diesem Dialog nicht angeboten werden.
2. Gewerbe, Name **TEST Notizvertrag GmbH**, eine TEST-Telefonnummer und bei **Notiz / Telefonnotiz** den Text **TEST Notiz atomar** eingeben; **Als Interessent speichern** wählen.
3. Die Kundenkarte muss direkt öffnen und die Notiz **TEST Notiz atomar** zeigen.
4. Datenbank prüfen: genau dieser Kunde besitzt eine `K-…`-Nummer, `internal_notes = 'TEST Notiz atomar'`, `payment_preference = 'vorkasse'`, `ziel_freigeschaltet = false`; zum Anlage-`client_event_id` existieren genau ein `CUSTOMER_CREATED_V1`-Ereignis und ein Anlage-Receipt mit derselben Notiz.

## Prüfergebnis

- `npx tsc --noEmit --incremental false`: **grün**.
- ESLint der betroffenen Produkt-, Vertrags- und Testdateien: **0 Fehler**.
- Gezielte Command-/UI-Prüfung: **3 Dateien / 28 Tests grün**.
- Reale lokale Kundenpersistenz: **1 Datei / 5 Tests grün**.
- `node scripts/ui/spec-check.mjs --screens=kundeneu`: **2 erwartet / 2 gefunden / 0 fehlend**.
- Rechtefälle ausdrücklich grün: ohne `geld` Zahlungsänderung abgelehnt; mit `geld` Vorkasse → Rechnung über den allgemeinen Kundenweg abgelehnt; Freischalt-Command ohne `geld` abgelehnt (`src/modules/customers/__tests__/customerPaymentGuards.test.ts:42`, `:50`, `:60`).
- Kein Klicktest und kein Screenshot durch Codex gemäß Regel 4d; der Owner führt den obigen Preview-Klickweg aus.

## Abgrenzung

- Die Oberfläche für Freischalten/Aufheben von „Rechnung auf Ziel“ gehört zur noch nicht baureifen Kundenseite F5 und wurde nicht vorgezogen. Der sichere Server-Command und sein Datenvertrag stehen dafür bereit; es gibt keinen provisorischen Nebenweg.
- Der eigenständige Notiz-Änderungsweg der Kundenkarte bleibt für spätere Änderungen erhalten. Nur die Erstanlage nutzt jetzt ausschließlich den atomaren Anlage-Vertrag.
