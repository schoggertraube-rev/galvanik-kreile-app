# KV-Folge U-247 — Server

Produkt-SHA: `46f0fce4` (Terminmigration in `aea6fade`).
Basis: main `efaf8853`. Kein neuer Oberflächenbau; die V04-Oberfläche bleibt gesperrt.
READY-Preview und Pflicht-CI werden nach Git-Build am endgültigen PR-Kopf ergänzt; derzeit keine Merge-Reife behauptet.

## Umsetzung

- Reine Terminänderung über bestehenden Update-Writer lässt Inhaltsfassung und Zusage bestehen. Optimistischer Sperrzähler und Änderungsereignis bleiben wirksam.
- Textänderung liefert einen schreibfreien Vorher→Nachher-Vorschlag über vorhandene Erkennung und KV-Leseports. Anwendung ausschließlich über `updateQuoteAction`: benannte Mengen, „statt“, „noch … dazu“, Stunden, Preisziel und Termin.
- Mehrdeutige Positionen, unbekannte Kalkulationsansätze, widersprüchliche Stunden/Preisziele, falsche Ausgangsmengen und fremde KV-Nummern erzeugen keinen anwendbaren Vorschlag. Keine erfundene Verteilung bei mehreren Positionen.
- `duplicateQuoteAction` verbindet vorhandene Kopiervorbereitung und `createQuoteAction`; gespeicherte Integerpreise und exakte Zeilensummen bleiben erhalten. Keine zweite Tabelle oder Schreibstrecke.
- Lage-Leseport ausdrücklich nicht gebaut (U-247).

## Gezielte Prüfung

| Beleg | Ergebnis |
|---|---|
| KV-12: echte Update-Action → Mailnachtrag/DB/Ereignis → Auftrag mit geändertem Termin, alte Zusage erhalten | PASS |
| Inhaltsänderung und konkurrierender PDF-/Mailversand bleiben fassungsgebunden | 2 Replay-Fälle PASS |
| Textvorschlag → echte Update-Action → DB und KV-Ansicht: Mengen, Stunden, Preisziel, Termin; widersprüchliche Eingaben ohne Kandidat | Replay PASS |
| KV-11: ein Duplizierbefehl → DB/Ereignis/Ansicht; Retry erzeugt keine zweite Kopie, exakte 10-EUR/3-Preise | Replay PASS |
| Bestehende Erkennungslogik | 15 Unit-Fälle PASS |
| Typprüfung, gezieltes ESLint, H18, No-Fake, Produkt-Diff-Leerzeichenprüfung | PASS |

Tests: `src/test/acceptance/kv_v04_server.integration.test.ts` und `src/lib/server/__tests__/intakeTextRecognition.test.ts`.
H18: Inventar 306, Schreibaktionen 143, getestet 84, Ausnahmen 59 (keine neue Ausnahme).
Modulprüfung: ausschließlich bekannte fremde `DESIGN_POINTER_PAGE_BINDING` aus uncommitteter Planung; keine neue Produktverletzung.
Keine lokale Gesamtsuite und keine externe Mailzustellung behauptet.

## Datenbank und Migration

`20261108060000_kv_date_preserves_edition.sql` additiv; vorher echte Rollbackprobe.
Dev-Projekt `syhaigjhsbpjmtnggqka`: Repo = Dev = 94 Migrationen; beide vorhandenen KV-Zeilen unverändert.
Maschinenbeleg: `docs/evidence/kv-u247/dev-migration.json`.
Keine Production-Migration. Neue Replay-Zeilen sind isolierte TEST-Daten.

## Bestehende Assertions

KV-12 erwartet gemäß U-247 bei reinem Terminwechsel nun Fassung 1/Zusage 1 statt neuer Inhaltsfassung; Originalnotiz bleibt erhalten, kein künstliches erneutes Senden/Zusagen. Auftrags-/Nachtragsbelege bleiben Pflicht.
KV-11 verwendet statt separater Vorbereitung plus Anlegen nun den einzelnen Duplizierbefehl; Preis-, Ereignis-, Wiederholungs- und Quellschutz-Assertions bleiben erhalten.

## Offen vor Merge-Bitte

Pflicht-CI, READY-Preview exakt am aktuellen Kopf, einmaliger Sichtlauf der berührten Bestandsseite und unabhängige PL-Diffprüfung. Kein Merge durch Codex.

## Synchronisierung nach Owner-Merge #196/#198

Main `edb2767d` integriert. Konflikte in Aktionsdatei, Testdatei und beiden Aktionsregistern als Vereinigung aufgeloest; Vor-Ort-Erfassung, Textvorschlag und Duplizierbefehl bleiben erhalten. Vier gezielte echte Replay-Faelle PASS (Text, Kopie, Vor-Ort Bestand/Neukunde), Typpruefung/gezieltes Lint/H18/No-Fake/Diff PASS. H18 jetzt Inventar307/Schreibaktionen144/getestet85/Ausnahmen59. Kein Testfall oder Assertion beim Zusammenfuehren gestrichen. CI und READY werden neu am synchronisierten Kopf gebunden; alte Kopfbelege gelten nur historisch. Die Preisangleichung aus PL08:40 erfolgt ausdruecklich als eigener Folge-PR.
