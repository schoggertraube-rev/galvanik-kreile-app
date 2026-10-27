# Abgabe Q13 · Kein Kunde ohne Auftrag

Status: **PASS**

Branch: `kreile/s1-p2-eingang`

Basis-SHA: `af98afa82dc1076ae11de6e489cbebb8a5d76412`

## Ursache und Änderung

- Der F1-Schreibweg übergab Neukunde und Auftrag bereits gemeinsam an `createOrderIntake`, prüfte einen veralteten Katalogstand aber erst nach der Kundenanlage.
- Diese fachliche Ablehnung konnte die Transaktion regulär beenden und dadurch nur den Kunden committen.
- Die vollständige Katalog-/Preisprüfung läuft jetzt vor der ersten Kundenmutation.
- Scheitert nach der Kundenanlage noch deren Rücklesung oder Anzeigename, wird die Transaktion durch einen Fehler zurückgerollt. Es gibt keinen zweiten Schreibweg und keine nachträgliche Löschung.

## Prüfschritte

- Command- und echter Renderpfad: 2 Dateien, 23/23 Tests PASS.
- Regression: ein veralteter Katalog wird abgewiesen, bevor `private.create_customer_v1` aufgerufen wird.
- ESLint der zwei geänderten TypeScript-Dateien: PASS.
- Statischer UI-Prüfschritt: `SPEC_CHECK screens=eingang,kundeneu expected=4 found=4 missing=0`.
- Keine Migration und keine Änderung an bestehenden Daten. Die sieben vorhandenen TEST-Kunden werden gemäß Löschverbot nicht entfernt.
- Gemäß Regel 4d wurden keine Codex-Screenshots oder Klicktests erzeugt.

## Owner-Abnahme (5 Minuten)

1. Als Rolf `Anlegen` öffnen und `Neukunde anlegen` wählen.
2. Einen eindeutig benannten Kunden `TEST Q13 <Zeit>` vollständig erfassen.
3. Eine Freitext-Position, Oberfläche und Liefertermin eintragen.
4. `Wareneingang buchen` klicken: Erwartung ist genau eine Auftragsbestätigung mit Auftragsnummer.
5. Prüfer-Readback: genau eine neue Kundenzeile mit diesem Namen und genau eine neue Auftragszeile mit deren `customer_id`; kein weiterer Kunde gleichen Namens.

## Abweichungen / Rest

- Bereits vorhandene verwaiste TEST-Datensätze bleiben unverändert; eine Datenbereinigung war nicht autorisiert.
- GitHub CI und Vercel werden gemäß Regel 4c nicht abgewartet. Ein später roter Pflichtcheck erhält Vorrang.
