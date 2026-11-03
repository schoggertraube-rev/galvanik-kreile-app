# AP-EIN Teil 0 – Generator und Replay-Fundament, Runde 51

Status: Draft zur Prüfung; kein Merge und keine fachliche Abnahme der späteren Teile.

## Stand und Produktbasis

Der Runtime-Produktbaum ist unverändert gegenüber `ba3f98e1c0e6744aca89185749935beed396ac43`.
Dessen exakte Git-Preview ist READY: https://galvanik-kreile-werkstatt-k0g11ms1p.vercel.app .
Teil 0 ändert ausschließlich Generator, Testgerüst, generierte Testdaten und diese Abgabe.
Der genaue neue Testfundament-SHA, seine Git-Preview und die Check-Liste werden im PR #166 und im laufenden Protokoll zugeordnet.

## Umsetzung

- BAUPLAN spec `a9474e3f73c3`, SHA-256 `888114C6247B711CC02D8C78BB9429ADCF9C494CFBC2E066F5202C6E966BB0D8`.
- Alle 306 Fälle aller 14 Modellseiten werden deterministisch erzeugt; Paketzuordnungen filtern keine Fälle aus.
- Die eingebetteten Fallbeschreibungen und Assertions sind bytegleich zur JSON-Projektion des Owner-Modells.
- Sieben ausschließlich synthetische Replay-Logins; Datenlagen werden je Fall mit ihren Abhängigkeiten in die echte lokale Datenbank eingebracht.
- Modell-/Speichernamen stehen einmal im Generator. Das vorhandene `private.intake_drafts` wird im privaten Schema geprüft und befüllt; es entsteht keine zweite Tabelle.
- Ergänzte Datums-/Wertplatzhalter, gezielte Netzwerkunterbrechung und erneutes Lesen sowie exakte Zeilen-/Delta-Prüfungen im Testgerüst.
- Auswahlerwartungen behalten die vom Owner-Modell verlangte `aria-pressed`- und Erfolg-Grün-Prüfung. Optionsknöpfe werden über ihren exakten sichtbaren Text im bezeichneten Steuerelement gefunden; ein umgebendes HTML-Label kann ihren zugänglichen Namen verändern.

## Prüfungen und offene Befunde

- Frische lokale Supabase-Replay-Kette ohne Seed: PASS. Keine Dev-Migration und keine Dev-Datenänderung.
- Produktions-Build gegen diese lokale Datenbank: PASS.
- Generator-Schreiben/`--check`, Modellvergleich aller 306 Fälle und Whitespace-Prüfung: PASS.
- Der breite lokale Lauf wurde nach 144 begonnenen Fällen wegen konkreter Gerüstbefunde beendet; er gilt ausdrücklich nicht als vollständiger PASS.
- D07: Fixture wurde im falschen Schema gesucht. Korrektur nutzt die bestehende private Tabelle samt echtem fremdem Login und isoliertem Rücksetzen der Testdaten.
- Gezielter Nachlauf D07 und TA14 gegen die echte Replay-DB: beide PASS. JSON-Fixtures verwenden den typisierten JSON-Parameter des vorhandenen Treibers statt doppelter Serialisierung.
- TA14 besteht bereits und wurde aus der Rotliste entfernt; verbleibend 267 Zukunftsfälle.
- E32: Die neue Modellkonvention verlangt zusätzlich Erfolg-Grün. Das bestehende Produkt nutzt dafür noch nicht die im Endversion-Bündel vorgesehene Formular-Markierung. Die Korrektur gehört zum folgenden UI-Fundament 0b. Dieser Befund wird nicht durch Entfernen der Farberwartung oder einen neuen Rotlisten-Eintrag verdeckt.
- Die vollständigen 306 Fälle laufen weiterhin in der CI. Die Check-Liste im PR nennt den wirklichen Stand; rot ist keine Abnahme.
- Die zusätzliche Ratchet-Vertragsfreigabe für den übergeordneten Anker #165 ist noch offen. Geschützte Baseline und Checker werden dafür hier nicht geändert.

## Owner-Klickweg und DB-Soll

Teil 0 liefert keine neue sichtbare Produktfunktion. Die Preview oben zeigt die unveränderte Produktbasis; die Korrektur des roten Plus folgt in Teil 2 nach dem UI-Fundament und der Kundenoberfläche.

DB-Soll dieses Teils: ausschließlich synthetische Daten auf `127.0.0.1:54322`; vorhandene Produkt-, Auth- und Tenant-Verträge bleiben bestehen. Die sichtbaren Teile bekommen ihren eigenen Preview-/Sichtnachweis und ihren jeweiligen echten Action–DB–Ansicht-Nachweis.
